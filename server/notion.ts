import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";
import { generateAnswerSummary } from "./notionSummary";
import { enqueueFailedWrite } from "./notionRetryQueue";

/**
 * Notion API client for syncing intake responses.
 * The Notion questionnaire database has one row per org × question.
 * Schema: Question (title), Question ID (rich_text), Answer (rich_text),
 *         Section (select), Institution Group (select), Slug (rich_text),
 *         Status (select), Updated By (rich_text), Files (files), Created At (date)
 */

let notionClient: Client | null = null;
let connectivityNotionClient: Client | null = null;

const QUESTIONNAIRE_DB_ID = ENV.notionDatabaseId || "";
const QUESTIONNAIRE_DATA_SOURCE_ID = ENV.notionDataSourceId || ENV.notionDatabaseId || "";

export function getNotionClient(): Client | null {
  if (!ENV.notionApiKey || !ENV.notionDatabaseId) {
    console.warn("Notion credentials not configured");
    return null;
  }

  if (!notionClient) {
    notionClient = new Client({ auth: ENV.notionApiKey });
  }

  return notionClient;
}

/**
 * Notion client for the connectivity matrix — only requires NOTION_API_KEY,
 * not the intake database ID, since the connectivity DB is configured separately.
 */
export function getConnectivityNotionClient(): Client | null {
  if (!ENV.notionApiKey) return null;
  if (!connectivityNotionClient) {
    connectivityNotionClient = new Client({ auth: ENV.notionApiKey });
  }
  return connectivityNotionClient;
}

/**
 * All orgs sync to Notion now (no radone filter).
 */
export function shouldSyncToNotion(_organizationSlug: string): boolean {
  return !!ENV.notionApiKey && !!ENV.notionDatabaseId;
}

/**
 * Find the Notion page ID for a specific org+question combination.
 * Uses dataSources.query with Institution Group select filter + paginated scan for Question ID match.
 */
export async function findNotionPageForQuestion(
  slug: string,
  questionId: string
): Promise<string | null> {
  const client = getNotionClient();
  if (!client) return null;

  try {
    let cursor: string | undefined = undefined;
    do {
      const result: any = await (client as any).dataSources.query({
        data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
        filter: {
          property: "Institution Group",
          select: { equals: slug },
        },
        page_size: 100,
        start_cursor: cursor,
      });

      for (const page of result.results) {
        const pageQid = page.properties?.["Question ID"]?.rich_text?.[0]?.plain_text || "";
        if (pageQid === questionId) {
          return page.id;
        }
      }

      cursor = result.has_more ? result.next_cursor : undefined;
    } while (cursor);

    return null;
  } catch (error) {
    console.error(`Error finding Notion page for ${slug}/${questionId}:`, error);
    return null;
  }
}

/**
 * Update the Answer field on an existing Notion row for a specific org+question.
 * Also updates Status to "Complete" and Updated By.
 */
export async function syncAnswerToNotion(
  slug: string,
  questionId: string,
  answer: string,
  updatedBy: string
): Promise<boolean> {
  const client = getNotionClient();
  if (!client || !shouldSyncToNotion(slug)) return false;

  try {
    const pageId = await findNotionPageForQuestion(slug, questionId);
    if (!pageId) {
      console.warn(`Notion page not found for ${slug}/${questionId} — skipping sync`);
      return false;
    }

    // Generate human-readable summary for JSON answers
    const summary = generateAnswerSummary(answer);

    const properties: any = {
      "Answer": { rich_text: [{ text: { content: answer.substring(0, 2000) } }] },
      "Status": { select: { name: answer ? "Complete" : "Not Started" } },
      "Updated By": { rich_text: [{ text: { content: updatedBy || "" } }] },
    };

    // Only set Summary if there's a meaningful summary (JSON answers)
    // Prefix with "⚙️ Auto" so staff know this column is machine-generated
    if (summary) {
      properties["Summary"] = { rich_text: [{ text: { content: `⚙️ Auto: ${summary}`.substring(0, 2000) } }] };
    }

    // "Last Updated From" column — tracks whether the last edit came from Portal or Notion
    properties["Last Updated From"] = { rich_text: [{ text: { content: "Portal" } }] };

    await client.pages.update({
      page_id: pageId,
      properties,
    });

    return true;
  } catch (error: any) {
    console.error(`Error syncing answer to Notion for ${slug}/${questionId}:`, error);
    // Enqueue for retry
    enqueueFailedWrite(
      { writeType: "questionnaire", data: { slug, questionId, answer, updatedBy } },
      error.message || "Unknown error"
    ).catch(() => {});
    return false;
  }
}

/**
 * Add file URL(s) to the Files column of an existing Notion row.
 * Appends to existing files rather than replacing them.
 */
export async function syncFileToNotion(
  slug: string,
  questionId: string,
  fileName: string,
  fileUrl: string
): Promise<boolean> {
  const client = getNotionClient();
  if (!client || !shouldSyncToNotion(slug)) return false;

  try {
    const pageId = await findNotionPageForQuestion(slug, questionId);
    if (!pageId) {
      console.warn(`Notion page not found for ${slug}/${questionId} — skipping file sync`);
      return false;
    }

    // Get existing files so we can append
    const page = await client.pages.retrieve({ page_id: pageId }) as any;
    const existingFiles = page.properties?.Files?.files || [];

    const updatedFiles = [
      ...existingFiles.map((f: any) => {
        if (f.type === "external") {
          return { type: "external", name: f.name, external: { url: f.external.url } };
        }
        // For Notion-hosted files, we can't re-use them in an update — skip
        return null;
      }).filter(Boolean),
      {
        type: "external",
        name: fileName,
        external: { url: fileUrl },
      },
    ];

    await client.pages.update({
      page_id: pageId,
      properties: {
        "Files": { files: updatedFiles },
        "Status": { select: { name: "Complete" } },
      },
    });

    return true;
  } catch (error) {
    console.error(`Error syncing file to Notion for ${slug}/${questionId}:`, error);
    return false;
  }
}

/**
 * Remove a file from the Files column of a Notion row by URL.
 */
export async function removeFileFromNotion(
  slug: string,
  questionId: string,
  fileUrl: string
): Promise<boolean> {
  const client = getNotionClient();
  if (!client || !shouldSyncToNotion(slug)) return false;

  try {
    const pageId = await findNotionPageForQuestion(slug, questionId);
    if (!pageId) return false;

    const page = await client.pages.retrieve({ page_id: pageId }) as any;
    const existingFiles = page.properties?.Files?.files || [];

    const updatedFiles = existingFiles
      .filter((f: any) => {
        if (f.type === "external") return f.external.url !== fileUrl;
        return true;
      })
      .map((f: any) => {
        if (f.type === "external") {
          return { type: "external", name: f.name, external: { url: f.external.url } };
        }
        return null;
      })
      .filter(Boolean);

    await client.pages.update({
      page_id: pageId,
      properties: {
        "Files": { files: updatedFiles },
      },
    });

    return true;
  } catch (error) {
    console.error(`Error removing file from Notion for ${slug}/${questionId}:`, error);
    return false;
  }
}

/**
 * Upload file to Notion and return file upload ID (legacy - kept for compatibility)
 */
export async function uploadFileToNotion(
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  const client = getNotionClient();
  if (!client) return null;

  try {
    const createResponse = await fetch("https://api.notion.com/v1/file_uploads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!createResponse.ok) {
      console.error("Failed to create Notion file upload:", await createResponse.text());
      return null;
    }

    const createData = await createResponse.json();
    const fileUploadId = createData.id;
    const uploadUrl = createData.upload_url;

    const formData = new FormData();
    const blob = new Blob([file as any], { type: mimeType });
    formData.append("file", blob, filename);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.notionApiKey}`,
        "Notion-Version": "2022-06-28",
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.error("Failed to upload file to Notion:", await uploadResponse.text());
      return null;
    }

    return fileUploadId;
  } catch (error) {
    console.error("Error uploading file to Notion:", error);
    return null;
  }
}

/**
 * Read an intake response page from Notion for an organization.
 * Returns the page properties or null if not found.
 * @deprecated Use findNotionPageForQuestion instead
 */
export async function readIntakeResponseFromNotion(
  organizationSlug: string
): Promise<Record<string, any> | null> {
  const client = getNotionClient();
  if (!client || !shouldSyncToNotion(organizationSlug)) {
    return null;
  }

  try {
    const queryResponse = await (client.databases as any).query({
      database_id: ENV.notionDatabaseId,
      filter: {
        property: "Organization Slug",
        rich_text: { equals: organizationSlug },
      },
    });

    if (queryResponse.results.length === 0) return null;

    const page = queryResponse.results[0] as any;
    return { pageId: page.id, properties: page.properties };
  } catch (error) {
    console.error("Error reading from Notion:", error);
    return null;
  }
}

/**
 * Legacy sync function — kept for backward compatibility.
 * @deprecated Use syncAnswerToNotion and syncFileToNotion instead
 */
export async function syncIntakeResponseToNotion(
  organizationName: string,
  organizationSlug: string,
  responses: Record<string, any>,
  fileUploads?: Record<string, string[]>
): Promise<string | null> {
  const client = getNotionClient();
  if (!client || !shouldSyncToNotion(organizationSlug)) {
    return null;
  }

  try {
    const queryResponse = await (client.databases as any).query({
      database_id: ENV.notionDatabaseId,
      filter: {
        property: "Organization Slug",
        rich_text: { equals: organizationSlug },
      },
    });

    const properties: any = {
      "Organization Name": {
        title: [{ text: { content: organizationName } }],
      },
      "Organization Slug": {
        rich_text: [{ text: { content: organizationSlug } }],
      },
      "Last Updated": {
        date: { start: new Date().toISOString() },
      },
    };

    if (Object.keys(responses).length > 0) {
      properties["Responses"] = {
        rich_text: [{ text: { content: JSON.stringify(responses, null, 2).substring(0, 2000) } }],
      };
    }

    if (fileUploads && Object.keys(fileUploads).length > 0) {
      const allFiles = Object.values(fileUploads).flat();
      if (allFiles.length > 0) {
        properties["Attachments"] = {
          files: allFiles.map((fileUploadId) => ({
            type: "file_upload",
            file_upload: { id: fileUploadId },
            name: "Uploaded File",
          })),
        };
      }
    }

    if (queryResponse.results.length > 0) {
      const pageId = queryResponse.results[0].id;
      await client.pages.update({ page_id: pageId, properties });
      return pageId;
    } else {
      const newPage = await client.pages.create({
        parent: { database_id: ENV.notionDatabaseId },
        properties,
      });
      return newPage.id;
    }
  } catch (error) {
    console.error("Error syncing to Notion:", error);
    return null;
  }
}
