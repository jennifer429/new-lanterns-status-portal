import { getEmailTransport } from "./transport";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { emailLog } from "../../drizzle/schema";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  type: "invite" | "reminder" | "task_status" | "filing_confirm";
  organizationId?: number | null;
  triggeredBy?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const transport = getEmailTransport();
  if (!transport) {
    console.error("[email] Cannot send — SYSTEM_EMAIL_ADDRESS or SYSTEM_EMAIL_APP_PASSWORD not configured");
    return false;
  }

  const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
  const from = `"${ENV.systemEmailDisplayName}" <${ENV.systemEmailAddress}>`;
  const replyTo = ENV.systemEmailReplyTo;

  try {
    const info = await transport.sendMail({
      from,
      to: toList.join(", "),
      cc: opts.cc?.join(", "),
      replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    const db = await getDb();
    if (db) {
      await db.insert(emailLog).values({
        direction: "outbound",
        type: opts.type,
        toAddress: toList.join(", "),
        fromAddress: ENV.systemEmailAddress,
        subject: opts.subject,
        status: "sent",
        organizationId: opts.organizationId ?? null,
        triggeredBy: opts.triggeredBy ?? null,
        messageId: info.messageId ?? null,
        metadata: { cc: opts.cc ?? [] },
      });
    }

    console.log(`[email] Sent ${opts.type} to ${toList.join(", ")}`);
    return true;
  } catch (err: any) {
    try {
      const db = await getDb();
      if (db) {
        await db.insert(emailLog).values({
          direction: "outbound",
          type: opts.type,
          toAddress: toList.join(", "),
          fromAddress: ENV.systemEmailAddress,
          subject: opts.subject,
          status: "failed",
          errorMessage: err.message?.substring(0, 500),
          organizationId: opts.organizationId ?? null,
          triggeredBy: opts.triggeredBy ?? null,
        });
      }
    } catch {}
    console.error(`[email] Failed to send ${opts.type} to ${toList.join(", ")}:`, err.message);
    return false;
  }
}
