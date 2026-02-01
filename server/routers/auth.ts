/**
 * Authentication router - Google Sheets-based auth
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CREDENTIALS_FILE = "New Lanterns Portal/credentials-template.csv";
const RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini";

interface Credential {
  email: string;
  password: string;
  orgSlug: string;
  role: string;
  name: string;
}

/**
 * Read credentials from Google Sheets via rclone
 */
async function getCredentials(): Promise<Credential[]> {
  try {
    // Download credentials file from Google Drive
    const tempFile = path.join("/tmp", `credentials-${Date.now()}.csv`);
    execSync(
      `rclone copy "manus_google_drive:${CREDENTIALS_FILE}" /tmp --config ${RCLONE_CONFIG}`,
      { stdio: "pipe" }
    );

    // Read the file
    const csvContent = fs.readFileSync(
      "/tmp/credentials-template.csv",
      "utf-8"
    );
    const lines = csvContent.trim().split("\n");

    // Parse CSV (skip header)
    const credentials: Credential[] = [];
    for (let i = 1; i < lines.length; i++) {
      const [email, password, orgSlug, role, name] = lines[i].split(",");
      if (email && password) {
        credentials.push({
          email: email.trim(),
          password: password.trim(),
          orgSlug: orgSlug.trim(),
          role: role.trim(),
          name: name.trim(),
        });
      }
    }

    return credentials;
  } catch (error) {
    console.error("[Auth] Failed to read credentials from Google Sheets:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to load credentials",
    });
  }
}

export const authRouter = router({
  /**
   * Login with email and password (checks Google Sheets)
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const credentials = await getCredentials();

      // Find matching credential
      const credential = credentials.find(
        (c) => c.email.toLowerCase() === input.email.toLowerCase()
      );

      if (!credential || credential.password !== input.password) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      return {
        email: credential.email,
        name: credential.name,
        role: credential.role,
        orgSlug: credential.orgSlug,
      };
    }),
});
