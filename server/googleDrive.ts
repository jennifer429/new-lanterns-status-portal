import { ENV } from "./_core/env";
import { Readable } from "stream";
import { storagePut, storageGet } from "./storage";
import { OAuth2Client } from "google-auth-library";

/**
 * Google Drive helper module.
 * Handles per-customer folder creation and file uploads.
 * Uses the GOOGLE_DRIVE_TOKEN (OAuth) provided by the Manus connector.
 * Falls back to S3/Forge storage if Google credentials are not configured.
 *
 * Uses @googleapis/drive (lightweight, ~3MB) instead of googleapis (~196MB).
 * Migrated 2026-05-31 for faster deploys.
 */

let driveClient: any = null;

async function getDrive() {
  if (driveClient) return driveClient;

  // The token is injected by the Manus connector into the environment
  const token = process.env.GOOGLE_DRIVE_TOKEN;
  
  if (!token) {
    console.warn("[GoogleDrive] GOOGLE_DRIVE_TOKEN is missing. Falling back to S3.");
    return null;
  }

  const { drive } = await import("@googleapis/drive");
  
  const oauth2Client = new OAuth2Client();
  oauth2Client.setCredentials({ access_token: token });

  driveClient = drive({ version: "v3", auth: oauth2Client });
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

  try {
      const res = await drive.files.create({
        requestBody: {
          name: customerName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parent],
        },
        fields: "id",
        supportsAllDrives: true,
      });

    const folderId = res.data.id;
    if (!folderId) throw new Error("Google Drive folder creation returned no ID");

    // Make folder accessible to anyone with the link
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });

    return folderId;
  } catch (error: any) {
    console.error(`[GoogleDrive] Failed to create folder for ${customerName}:`, error.message);
    return null;
  }
}

export type UploadResult = {
  driveUrl: string | null;
  driveFileId: string | null;
  s3Url: string;
  s3Key: string;
};

/**
 * Upload a file to a specific Google Drive folder (per-customer) AND backup to S3.
 * If orgDriveFolderId is provided, uploads there; otherwise uses root folder.
 * Returns both Drive and S3 URLs so callers can track exact status.
 */
export async function uploadFileToDriveAndS3(
  fileName: string,
  fileBuffer: Buffer,
  orgDriveFolderId?: string | null,
  fallbackOrgName?: string,
  contentType?: string | null
): Promise<UploadResult> {
  const drive = await getDrive();

  // Use the real MIME type so the stored object (and its download URL) renders
  // inline in the browser / <img> tags instead of forcing a download.
  const mimeType = contentType || "application/octet-stream";

  // 1. Always upload to S3 as the durable backup
  const sanitizedOrg = (fallbackOrgName || "unknown").replace(/[^a-zA-Z0-9-_]/g, "_");
  const s3Key = `uploads/${sanitizedOrg}/${fileName}`;
  await storagePut(s3Key, fileBuffer, mimeType);
  const { url: s3Url } = await storageGet(s3Key);
  
  let driveUrl: string | null = null;
  let driveFileId: string | null = null;

  // 2. Upload to Google Drive if configured
  if (drive) {
    try {
      let parentFolder = orgDriveFolderId || ENV.googleDriveFolderId || "1STogLQnTku6B0iAkAAqt7oFKFtaUy1Nu";

      let uploadRes;
      try {
        uploadRes = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [parentFolder],
          },
          media: {
            mimeType,
            body: Readable.from(fileBuffer),
          },
          fields: "id,webViewLink",
          supportsAllDrives: true,
        });
      } catch (err: any) {
        const rootFolder = ENV.googleDriveFolderId || "1STogLQnTku6B0iAkAAqt7oFKFtaUy1Nu";
        if (err.message && err.message.includes("File not found") && parentFolder !== rootFolder) {
          console.warn(`[GoogleDrive] Org folder ${parentFolder} not found, falling back to root folder`);
          parentFolder = rootFolder;
          uploadRes = await drive.files.create({
            requestBody: {
              name: fileName,
              parents: [parentFolder],
            },
            media: {
              mimeType,
              body: Readable.from(fileBuffer),
            },
            fields: "id,webViewLink",
            supportsAllDrives: true,
          });
        } else {
          throw err;
        }
      }

      driveFileId = uploadRes.data.id || null;
      
      if (driveFileId) {
        // Make file readable by anyone with the link
        await drive.permissions.create({
          fileId: driveFileId,
          requestBody: { role: "reader", type: "anyone" },
          supportsAllDrives: true,
        });

        // Fetch the shareable link
        const meta = await drive.files.get({
          fileId: driveFileId,
          fields: "webViewLink",
          supportsAllDrives: true,
        });

        driveUrl = meta.data.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
      }
    } catch (error: any) {
      console.error(`[GoogleDrive] Failed to upload ${fileName}:`, error.message);
      // We don't throw here because we still have the S3 backup
    }
  }

  return { driveUrl, driveFileId, s3Url, s3Key };
}

/**
 * Resolve a stored file attachment to a URL that renders directly in the browser
 * (usable in <img> tags and openable as the raw file).
 *
 * Handles three cases:
 *  1. Rows whose `driveFileId` holds the S3 object key (`uploads/...`) — regenerate
 *     a fresh download URL from storage (also avoids stale/expired presigned URLs).
 *  2. Legacy rows whose `fileUrl` is a Google Drive *preview* page
 *     (`drive.google.com/file/d/<id>/view`) — convert to Drive's direct content
 *     endpoint so images render instead of returning Drive's HTML viewer.
 *  3. Anything else — return the stored URL unchanged.
 */
export async function resolveFileUrl(
  storedUrl: string,
  driveFileId?: string | null
): Promise<string> {
  // Case 1: driveFileId is an S3 key (no scheme, path-like) → fresh storage URL.
  if (driveFileId && !/^https?:\/\//.test(driveFileId) && driveFileId.includes("/")) {
    try {
      const { url } = await storageGet(driveFileId);
      return url;
    } catch {
      // fall through to other strategies
    }
  }

  // Case 2: a Google Drive preview link → direct render URL.
  const previewMatch = /drive\.google\.com\/file\/d\/([^/]+)/.exec(storedUrl || "");
  const driveId =
    previewMatch?.[1] ||
    (driveFileId && !driveFileId.includes("/") && /^[A-Za-z0-9_-]{20,}$/.test(driveFileId)
      ? driveFileId
      : null);
  if (driveId) {
    // `thumbnail` returns actual image bytes (full-size up to sz) for images, PDFs
    // and docs, and renders in <img> without the Drive auth/CORS issues that block
    // webViewLink / uc?export=view.
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
  }

  return storedUrl;
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
      supportsAllDrives: true,
    });
    return (
      meta.data.webViewLink ||
      `https://drive.google.com/file/d/${driveFileId}/view`
    );
  } catch {
    return null;
  }
}
