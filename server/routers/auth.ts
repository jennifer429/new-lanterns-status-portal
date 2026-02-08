/**
 * Authentication router - Database-based auth with bcrypt
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
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
      
      // If user has organizationId, they're a hospital user → go to their org portal
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
      // If user has clientId, they're a partner admin → go to partner admin page
      else if (user.clientId) {
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, user.clientId))
          .limit(1);
        if (client) {
          orgSlug = `${client.slug}/admin`;
        }
      }
      // Otherwise, platform admin → go to /org/admin
      else {
        orgSlug = "org/admin";
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
      console.log('[auth.login] Set cookie with options:', { ...cookieOptions, maxAge: ONE_YEAR_MS });
      console.log('[auth.login] Session token for user:', user.email, 'openId:', user.openId);

      console.log('[auth.login] Returning orgSlug:', orgSlug);
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
