/**
 * Authentication router - Google Sheets-based auth
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CREDENTIALS_FILE = "New Lantern Implementation Site - Authentication.xlsx";
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
    execSync(
      `rclone copy "manus_google_drive:${CREDENTIALS_FILE}" /tmp --config ${RCLONE_CONFIG}`,
      { stdio: "pipe" }
    );

    // Read Excel file using Python
    const pythonScript = `
import pandas as pd
import json
df = pd.read_excel('/tmp/New Lantern Implementation Site - Authentication.xlsx')
data = df.to_dict('records')
print(json.dumps(data))
`;
    const result = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    const rows = JSON.parse(result);

    // Parse credentials
    const credentials: Credential[] = [];
    for (const row of rows) {
      const email = row['User'];
      const password = row['Password'];
      const siteName = row['Intake Site'];
      
      if (email && password) {
        // Determine role and org slug
        const role = siteName === 'Admin Page' ? 'admin' : 'user';
        const orgSlug = siteName === 'Admin Page' ? 'admin' : 
          siteName.toLowerCase()
            .replace(/^.* - /, '') // Remove prefix like "RadOne - "
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        credentials.push({
          email: email.trim(),
          password: password.trim(),
          orgSlug,
          role,
          name: email.split('@')[0], // Use email prefix as name
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

// Store password reset tokens in memory (in production, use database)
const resetTokens = new Map<string, { email: string; expires: number }>();

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

  /**
   * Request password reset (checks if email exists in Google Sheets)
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const credentials = await getCredentials();

      // Check if email exists
      const credential = credentials.find(
        (c) => c.email.toLowerCase() === input.email.toLowerCase()
      );

      if (credential) {
        // Generate reset token
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expires = Date.now() + 3600000; // 1 hour

        resetTokens.set(token, {
          email: credential.email,
          expires,
        });

        // In production, send email with reset link
        // For now, just log it
        const resetLink = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        console.log(`[Auth] Password reset link for ${credential.email}: ${resetLink}`);

        // TODO: Send email via Gmail MCP or notification API
      }

      // Always return success (security best practice)
      return {
        success: true,
        message: "If an account exists with this email, you'll receive a password reset link. Please check your inbox and contact New Lantern support if you need assistance.",
      };
    }),

  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const tokenData = resetTokens.get(input.token);

      if (!tokenData || tokenData.expires < Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      // In production, update password in Google Sheets
      // For now, just log it
      console.log(`[Auth] Password reset for ${tokenData.email}: ${input.newPassword}`);

      // Remove used token
      resetTokens.delete(input.token);

      // TODO: Update password in Google Sheets
      // This requires writing back to the sheet, which is more complex
      // For now, admin must manually update passwords in the sheet

      return {
        success: true,
        message: "Password reset request received. Please contact New Lantern support to complete the password change.",
      };
    }),
});
