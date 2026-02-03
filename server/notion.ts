import { Client } from "@notionhq/client";
import { ENV } from "./_core/env";

/**
 * Notion API client for syncing intake responses
 * Only syncs organizations whose slug starts with "radone"
 */

let notionClient: Client | null = null;

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
 * Create or update a page in Notion database for an organization
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
    // Search for existing page for this organization using search API
    const searchResponse = await client.search({
      query: organizationSlug,
      filter: {
        property: "object",
        value: "page",
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

    // Add response data as properties (you'll need to customize this based on your database schema)
    // For now, we'll store responses as a JSON string in a text property
    if (Object.keys(responses).length > 0) {
      properties["Responses"] = {
        rich_text: [{ text: { content: JSON.stringify(responses, null, 2).substring(0, 2000) } }],
      };
    }

    // Add file attachments if any
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

    if (searchResponse.results.length > 0) {
      // Update existing page
      const pageId = searchResponse.results[0].id;
      await client.pages.update({
        page_id: pageId,
        properties,
      });
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
