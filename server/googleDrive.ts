import { ENV } from "./_core/env";
import { Readable } from "stream";
import { storagePut, storageGet } from "./storage";

/**
 * Google Drive helper module.
 * Handles per-customer folder creation and file uploads.
 * Falls back to S3/Forge storage if Google credentials are not configured.
 */

let driveClient: any = null;

async function getDrive() {
  if (driveClient) return driveClient;

  if (!ENV.googleServiceAccountEmail || !ENV.googleServiceAccountPrivateKey) {
    return null;
  }

  const { google } = await import("googleapis");
  const privateKey = ENV.googleServiceAccountPrivateKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: ENV.googleServiceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

/**
 * Create a subfolder inside the root Google Drive folder for a customer.
 * Returns the new folder's ID, or null if Drive is not configured.
 */
export async function createCustomerFolder(
  customerName: string,
  parentFolderId?: string
): Promise<string | null> {
  const drive = await getDrive();
  if (!drive) return null;

  const parent = parentFolderId || ENV.googleDriveFolderId;

  const res = await drive.files.create({
    requestBody: {
      name: customerName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent],
    },
    fields: "id",
  });

  const folderId = res.data.id;
  if (!folderId) throw new Error("Google Drive folder creation returned no ID");

  // Make folder accessible to anyone with the link
  await drive.permissions.create({
    fileId: folderId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return folderId;
}

/**
 * Upload a file to a specific Google Drive folder (per-customer).
 * If orgDriveFolderId is provided, uploads there; otherwise uses root folder.
 * Falls back to S3 if Google credentials are not configured.
 * Returns the shareable URL.
 */
export async function uploadFileToDrive(
  fileName: string,
  fileBuffer: Buffer,
  orgDriveFolderId?: string | null,
  fallbackOrgName?: string
): Promise<{ fileUrl: string; driveFileId?: string }> {
  const drive = await getDrive();

  if (drive) {
    const parentFolder = orgDriveFolderId || ENV.googleDriveFolderId;

    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentFolder],
      },
      media: {
        mimeType: "application/octet-stream",
        body: Readable.from(fileBuffer),
      },
      fields: "id,webViewLink",
    });

    const fileId = uploadRes.data.id;
    if (!fileId) throw new Error("Google Drive upload returned no file ID");

    // Make file readable by anyone with the link
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Fetch the shareable link
    const meta = await drive.files.get({
      fileId,
      fields: "webViewLink",
    });

    const fileUrl =
      meta.data.webViewLink ||
      `https://drive.google.com/file/d/${fileId}/view`;

    return { fileUrl, driveFileId: fileId };
  }

  // Fallback: use Forge storage proxy
  const sanitizedOrg = (fallbackOrgName || "unknown").replace(
    /[^a-zA-Z0-9-_]/g,
    "_"
  );
  const key = `uploads/${sanitizedOrg}/${fileName}`;
  await storagePut(key, fileBuffer);
  const { url } = await storageGet(key);
  return { fileUrl: url };
}

/**
 * Get a shareable link for a Drive file by ID.
 */
export async function getDriveFileLink(
  driveFileId: string
): Promise<string | null> {
  const drive = await getDrive();
  if (!drive) return null;

  try {
    const meta = await drive.files.get({
      fileId: driveFileId,
      fields: "webViewLink",
    });
    return (
      meta.data.webViewLink ||
      `https://drive.google.com/file/d/${driveFileId}/view`
    );
  } catch {
    return null;
  }
}
