import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";

/**
 * Notion API client for syncing intake responses
 * Only syncs organizations whose slug starts with "radone"
 */

let notionClient: Client | null = null;
let connectivityNotionClient: Client | null = null;

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
 * Check if organization should sync to Notion
 */
export function shouldSyncToNotion(organizationSlug: string): boolean {
  return organizationSlug.toLowerCase().startsWith("radone");
}

/**
 * Upload file to Notion and return file upload ID
 */
export async function uploadFileToNotion(
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  const client = getNotionClient();
  if (!client) return null;

  try {
    // Step 1: Create file upload object
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

    // Step 2: Send file contents
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
 */
export async function readIntakeResponseFromNotion(
  organizationSlug: string
): Promise<Record<string, any> | null> {
  const client = getNotionClient();
  if (!client || !shouldSyncToNotion(organizationSlug)) {
    return null;
  }

  try {
    const queryResponse = await client.databases.query({
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
 * Create or update a page in Notion database for an organization.
 * Uses databases.query() with an exact slug filter instead of search() for reliable matching.
 */
export async function syncIntakeResponseToNotion(
  organizationName: string,
  organizationSlug: string,
  responses: Record<string, any>,
  fileUploads?: Record<string, string[]> // questionId -> array of file upload IDs
): Promise<string | null> {
  const client = getNotionClient();
  if (!client || !shouldSyncToNotion(organizationSlug)) {
    return null;
  }

  try {
    // Query for existing page by exact slug match (reliable, unlike search())
    const queryResponse = await client.databases.query({
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
      // Update existing page
      const pageId = queryResponse.results[0].id;
      await client.pages.update({ page_id: pageId, properties });
      return pageId;
    } else {
      // Create new page
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
