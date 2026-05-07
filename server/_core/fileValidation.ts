import crypto from "crypto";
import { z } from "zod";

export const MAX_FILE_BASE64_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME =
  /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.[a-z]+|vnd\.ms-excel|vnd\.ms-powerpoint|json|zip|x-zip-compressed|octet-stream)|text\/(plain|csv|html|markdown))$/i;

export const fileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[^/\\\0]+$/, "fileName must not contain path separators or null bytes");

export const fileDataSchema = z
  .string()
  .min(1)
  .max(MAX_FILE_BASE64_BYTES)
  .regex(/^[A-Za-z0-9+/=\r\n]+$/, "fileData must be valid base64");

export const mimeTypeSchema = z
  .string()
  .max(255)
  .regex(ALLOWED_MIME, "mimeType is not in the allowed list");

export const fileUploadInput = {
  fileName: fileNameSchema,
  fileData: fileDataSchema,
  mimeType: mimeTypeSchema,
};

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

export function makeSafeFileKey(name: string): string {
  const safe = sanitizeFileName(name);
  const rand = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${rand}-${safe}`;
}
