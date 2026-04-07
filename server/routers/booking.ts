/**
 * Booking router — invitation-only training booking for New Lantern.
 *
 * Public procedures (no auth required):
 *   - validateToken  : check if an invite token is valid, return pre-fill data
 *   - submitBooking  : submit a completed booking (consumes the token)
 *
 * Admin procedures (admin role required):
 *   - createInvitation  : generate a new invite token (optionally with pre-fill)
 *   - listInvitations   : list all invitations with status
 *   - revokeInvitation  : mark an invitation as revoked
 */

import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { bookingInvitations, bookingSubmissions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(24).toString("hex"); // 48-char hex token
}

export const bookingRouter = router({
  /**
   * Validate an invitation token.
   * Returns pre-fill data so the form can pre-populate fields.
   * Does NOT consume the token — only submitBooking does that.
   */
  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [invite] = await db
        .select()
        .from(bookingInvitations)
        .where(eq(bookingInvitations.token, input.token))
        .limit(1);

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }

      if (invite.revokedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has been revoked" });
      }

      if (invite.usedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has already been used" });
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has expired" });
      }

      return {
        valid: true,
        prefillName: invite.prefillName ?? "",
        prefillEmail: invite.prefillEmail ?? "",
        prefillOrg: invite.prefillOrg ?? "",
      };
    }),

  /**
   * Submit a booking. Validates the token and marks it as used.
   */
  submitBooking: publicProcedure
    .input(
      z.object({
        token: z.string(),
        fullName: z.string().min(1),
        email: z.string().email(),
        organization: z.string().optional(),
        phone: z.string().optional(),
        trainingType: z.enum(["admin", "technologist"]),
        selectedDate: z.string(), // YYYY-MM-DD
        selectedTime: z.string(), // e.g. "10:00 AM"
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Re-validate token at submit time
      const [invite] = await db
        .select()
        .from(bookingInvitations)
        .where(eq(bookingInvitations.token, input.token))
        .limit(1);

      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      if (invite.revokedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has been revoked" });
      if (invite.usedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has already been used" });
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has expired" });
      }

      // Create submission
      await db.insert(bookingSubmissions).values({
        invitationId: invite.id,
        fullName: input.fullName,
        email: input.email,
        organization: input.organization ?? null,
        phone: input.phone ?? null,
        trainingType: input.trainingType,
        selectedDate: input.selectedDate,
        selectedTime: input.selectedTime,
        notes: input.notes ?? null,
      });

      // Mark invitation as used
      await db
        .update(bookingInvitations)
        .set({ usedAt: new Date() })
        .where(eq(bookingInvitations.id, invite.id));

      return { success: true };
    }),

  /**
   * Create a new invitation token.
   * Admin only. Returns the token so the admin can share the link via Pylon.
   */
  createInvitation: adminProcedure
    .input(
      z.object({
        prefillName: z.string().optional(),
        prefillEmail: z.string().email().optional().or(z.literal("")),
        prefillOrg: z.string().optional(),
        note: z.string().optional(),
        expiresInDays: z.number().int().positive().optional(), // undefined = never expires
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const token = generateToken();
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      await db.insert(bookingInvitations).values({
        token,
        prefillName: input.prefillName || null,
        prefillEmail: input.prefillEmail || null,
        prefillOrg: input.prefillOrg || null,
        note: input.note || null,
        expiresAt,
        createdBy: ctx.user.email ?? "unknown",
      });

      return { token };
    }),

  /**
   * List all invitations. Admin only.
   */
  listInvitations: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const invitations = await db
      .select()
      .from(bookingInvitations)
      .orderBy(desc(bookingInvitations.createdAt));

    return invitations;
  }),

  /**
   * Revoke an invitation. Admin only.
   */
  revokeInvitation: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(bookingInvitations)
        .set({ revokedAt: new Date() })
        .where(eq(bookingInvitations.id, input.id));

      return { success: true };
    }),

  /**
   * List all booking submissions. Admin only.
   */
  listSubmissions: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const submissions = await db
      .select()
      .from(bookingSubmissions)
      .orderBy(desc(bookingSubmissions.createdAt));

    return submissions;
  }),
});
