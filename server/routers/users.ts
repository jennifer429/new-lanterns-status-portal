/**
 * Users router - User management for admin
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { requireDb } from "../db";
import { users, organizations } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

export const usersRouter = router({
  /**
   * List all users with their organization info
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await requireDb();

    const allUsers = await db
      .select({
        id: users.id,
        openId: users.openId,
        email: users.email,
        name: users.name,
        role: users.role,
        organizationId: users.organizationId,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .orderBy(desc(users.createdAt));

    return allUsers;
  }),

  /**
   * Create a new user
   */
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        role: z.enum(["admin", "user"]),
        organizationId: z.number().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await requireDb();

      // Check if email already exists
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, 10);

      // Create user
      await db.insert(users).values({
        openId: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        passwordHash,
        organizationId: input.organizationId,
      });

      return {
        success: true,
        message: "User created successfully",
      };
    }),

  /**
   * Update an existing user
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        name: z.string().min(1).optional(),
        role: z.enum(["admin", "user"]).optional(),
        organizationId: z.number().nullable().optional(),
        clientId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await requireDb();

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // If email is being changed, check for conflicts
      if (input.email && input.email.toLowerCase() !== user.email) {
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, input.email.toLowerCase()))
          .limit(1);

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A user with this email already exists",
          });
        }
      }

      // Build update object
      const updateData: any = {};
      if (input.email) updateData.email = input.email.toLowerCase();
      if (input.name) updateData.name = input.name;
      if (input.role) updateData.role = input.role;
      if (input.organizationId !== undefined) updateData.organizationId = input.organizationId;
      if (input.clientId !== undefined) updateData.clientId = input.clientId;
      if (input.password) {
        updateData.passwordHash = await bcrypt.hash(input.password, 10);
      }

      // Update user
      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, input.id));

      return {
        success: true,
        message: "User updated successfully",
      };
    }),

  /**
   * Delete a user
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await requireDb();

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Delete user
      await db.delete(users).where(eq(users.id, input.id));

      return {
        success: true,
        message: "User deleted successfully",
      };
    }),
});
