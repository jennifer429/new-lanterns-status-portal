import { google } from "googleapis";
import { ENV } from "./_core/env";

function getDriveClient() {
  const credentials = JSON.parse(ENV.googleServiceAccountKey || "{}");
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

async function findFolder(drive: any, name: string, parentId: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id || null;
}

async function findOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id!;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const drive = getDriveClient();
  const parts = relKey.split("/");
  const fileName = parts.pop()!;
  const [partnerName, customerName] = parts;

  const rootFolderId = ENV.googleDriveFolderId;
  const partnerFolderId = await findOrCreateFolder(drive, partnerName, rootFolderId);
  const customerFolderId = customerName
    ? await findOrCreateFolder(drive, customerName, partnerFolderId)
    : partnerFolderId;

  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const { Readable } = await import("stream");
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [customerFolderId],
    },
    media: { mimeType: contentType, body: stream },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return { key: relKey, url: res.data.webViewLink! };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const drive = getDriveClient();
  const fileName = relKey.split("/").pop()!;

  const res = await drive.files.list({
    q: `name = '${fileName}' and trashed = false`,
    fields: "files(id, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const file = res.data.files?.[0];
  if (!file) throw new Error(`File not found: ${relKey}`);

  return { key: relKey, url: file.webViewLink! };
}
