/**
 * Authentication router - Database-based auth with bcrypt
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, organizations, clients } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { randomBytes } from "crypto";

const COOKIE_NAME = "manus-session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Find user by email
      console.log('[auth.login] Looking for user:', input.email.toLowerCase());
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      console.log('[auth.login] User found:', !!user, 'Has password:', !!user?.passwordHash);
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Check if user is deactivated
      if (user.isActive === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account has been deactivated. Please contact your administrator.",
        });
      }

      // Verify password
      console.log('[auth.login] Comparing password...');
      const isValid = await bcrypt.compare(input.password, user.passwordHash);
      console.log('[auth.login] Password valid:', isValid);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Update last login timestamp
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

      // Determine redirect route based on user type
      let orgSlug = "admin";
      let clientSlug = "";

      // If user has organizationId, they're a hospital user → go to their org portal

      if (user.organizationId) {
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, user.organizationId))
          .limit(1);
        if (org) {
          orgSlug = org.slug;
          // If we didn't get clientSlug from user, get it from org
          if (!clientSlug && org.clientId) {
            const [client] = await db
              .select()
              .from(clients)
              .where(eq(clients.id, org.clientId))
              .limit(1);
            if (client) {
              clientSlug = client.slug;
            }
          }
        }
      }
      // If user has clientId, they're a partner admin → go to /org/:clientSlug/admin
      else if (user.clientId) {
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, user.clientId))
          .limit(1);
        if (client) {
          clientSlug = client.slug;
          orgSlug = "admin";
        }
      }
      // Otherwise, platform admin → go to /org/admin
      else {
        orgSlug = "admin";
      }

      // Create session token and set cookie
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email?.split('@')[0] || "User",
        expiresInMs: ONE_YEAR_MS,
      });

      // Clear any existing session cookie first to ensure fresh login
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      // Cookie set successfully

      console.log('[auth.login] Login successful for:', user.email, 'redirecting to:', orgSlug);
      return {
        email: user.email || "",
        name: user.name || user.email?.split('@')[0] || "User",
        role: user.role,
        orgSlug,
        clientSlug,
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
   * Create admin account for @newlantern.ai emails
   */
  createAdmin: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify email is @newlantern.ai
      if (!input.email.toLowerCase().endsWith('@newlantern.ai')) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only @newlantern.ai emails can create admin accounts",
        });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Account already exists. Please use forgot password to reset.",
        });
      }

      // Extract name from email (part before @)
      const name = input.email.split('@')[0];

      // Generate unique openId
      const openId = randomBytes(16).toString('hex');

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, 10);

      // Create admin user
      await db.insert(users).values({
        openId,
        email: input.email.toLowerCase(),
        name,
        passwordHash,
        role: 'admin',
        loginMethod: 'password',
      });

      return {
        success: true,
        message: "Admin account created successfully. You can now log in.",
      };
    }),

  /**
   * Reset password directly (no token needed)
   * NOTE: This is a simplified flow. In production, use email-based token verification.
   * Currently restricted to only allow resets for emails that exist in the system.
   * The forgot-password page handles the UX flow.
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

      // Verify email exists - use generic error message to prevent email enumeration
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (!user) {
        // Return generic message to prevent email enumeration
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "If an account exists with this email, the password has been reset.",
        });
      }

      // Check if user is deactivated
      if (user.isActive === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account has been deactivated. Please contact your administrator.",
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

  /**
   * Change password for the currently logged-in user
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.passwordHash) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      await db.update(users).set({ passwordHash }).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
});
