/**
 * Authentication router - Database-based auth with bcrypt
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, organizations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Store password reset tokens in memory (in production, use database table)
const resetTokens = new Map<string, { email: string; expires: number }>();

export const authRouter = router({
  /**
   * Login with email and password (checks database)
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Verify password
      const isValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Get organization slug if user has organizationId
      let orgSlug = "admin";
      if (user.organizationId) {
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, user.organizationId))
          .limit(1);
        if (org) {
          orgSlug = org.slug;
        }
      }

      return {
        email: user.email || "",
        name: user.name || user.email?.split('@')[0] || "User",
        role: user.role,
        orgSlug,
      };
    }),

  /**
   * Request password reset (checks if email exists in database)
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check if email exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (user) {
        // Generate reset token
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expires = Date.now() + 3600000; // 1 hour

        resetTokens.set(token, {
          email: user.email || "",
          expires,
        });

        // In production, send email with reset link
        // For now, just log it
        const resetLink = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        console.log(`[Auth] Password reset link for ${user.email || 'unknown'}: ${resetLink}`);

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

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Hash new password
      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      // Update password in database
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.email, tokenData.email));

      // Remove used token
      resetTokens.delete(input.token);

      return {
        success: true,
        message: "Password has been reset successfully. You can now log in with your new password.",
      };
    }),
});
