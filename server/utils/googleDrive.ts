import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { nanoid } from "nanoid";

const execAsync = promisify(exec);

const RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini";
const DRIVE_REMOTE = "manus_google_drive";
const ROOT_FOLDER = "New-Lanterns-Intake";

/**
 * Upload a file to a partner- and org-specific Google Drive folder.
 *
 * Folder structure: New-Lanterns-Intake/{clientSlug}/{orgSlug}/
 *
 * @returns The Google Drive shareable link for the uploaded file.
 */
export async function uploadToGoogleDrive(
  fileName: string,
  fileBuffer: Buffer,
  clientSlug: string,
  orgSlug: string
): Promise<string> {
  const tempFilePath = path.join(os.tmpdir(), `${nanoid()}-${fileName}`);

  try {
    await writeFile(tempFilePath, fileBuffer);

    const folderPath = `${DRIVE_REMOTE}:${ROOT_FOLDER}/${clientSlug}/${orgSlug}`;

    await execAsync(
      `rclone copy "${tempFilePath}" "${folderPath}" --config ${RCLONE_CONFIG}`
    );

    // Give Google Drive a moment to process the upload before requesting a link
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const remotePath = `${folderPath}/${fileName}`;
    let shareableLink = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { stdout } = await execAsync(
          `rclone link "${remotePath}" --config ${RCLONE_CONFIG}`
        );
        shareableLink = stdout.trim();
        break;
      } catch (err) {
        if (attempt === 3) {
          throw new Error(`Failed to get shareable link after 3 attempts: ${err}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    await unlink(tempFilePath);
    return shareableLink;
  } catch (error) {
    try {
      await unlink(tempFilePath);
    } catch {}
    throw error;
  }
}
