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

      // Update last login timestamp
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

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
   * Check if email exists (for forgot password flow)
   */
  checkEmail: publicProcedure
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

      return {
        exists: !!user,
        email: input.email,
      };
    }),

  /**
   * Reset password directly (no token needed)
   */
  resetPasswordDirect: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify email exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Please contact New Lantern support",
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      // Update password in database
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.email, input.email.toLowerCase()));

      return {
        success: true,
        message: "Password has been reset successfully. You can now log in with your new password.",
      };
    }),
});
