import { getEmailTransport } from "./transport";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { emailLog } from "../../drizzle/schema";
import { dispatch } from "../notionSyncDispatcher";

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

  console.log(`[email] Attempting ${opts.type} email to ${toList.join(", ")} (subject: "${opts.subject}")`);

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

    console.log(`[email] Sent ${opts.type} to ${toList.join(", ")} — messageId: ${info.messageId}`);

    const db = await getDb();
    let logId = 0;
    if (db) {
      const [result] = await db.insert(emailLog).values({
        direction: "outbound",
        type: opts.type,
        toAddress: toList.join(", "),
        fromAddress: ENV.systemEmailAddress,
        subject: opts.subject,
        status: "sent",
        organizationId: opts.organizationId ?? null,
        triggeredBy: opts.triggeredBy ?? null,
        messageId: info.messageId ?? null,
        metadata: { cc: opts.cc ?? [], response: info.response },
      });
      logId = result.insertId;
    }

    dispatch.emailLog({
      mysqlId: logId,
      direction: "outbound",
      type: opts.type,
      toAddress: toList.join(", "),
      fromAddress: ENV.systemEmailAddress,
      subject: opts.subject,
      status: "sent",
      organizationId: opts.organizationId ?? null,
      triggeredBy: opts.triggeredBy ?? null,
      createdAt: new Date(),
    });

    return true;
  } catch (err: any) {
    const errorDetail = err.message?.substring(0, 500) || "Unknown error";
    const errorCode = err.code || err.responseCode || "UNKNOWN";
    console.error(`[email] FAILED ${opts.type} to ${toList.join(", ")} — code: ${errorCode}, error: ${errorDetail}`);

    let logId = 0;
    try {
      const db = await getDb();
      if (db) {
        const [result] = await db.insert(emailLog).values({
          direction: "outbound",
          type: opts.type,
          toAddress: toList.join(", "),
          fromAddress: ENV.systemEmailAddress,
          subject: opts.subject,
          status: "failed",
          errorMessage: `[${errorCode}] ${errorDetail}`,
          organizationId: opts.organizationId ?? null,
          triggeredBy: opts.triggeredBy ?? null,
        });
        logId = result.insertId;
      }
    } catch (dbErr: any) {
      console.error(`[email] Could not log failure to DB:`, dbErr.message);
    }

    dispatch.emailLog({
      mysqlId: logId,
      direction: "outbound",
      type: opts.type,
      toAddress: toList.join(", "),
      fromAddress: ENV.systemEmailAddress,
      subject: opts.subject,
      status: "failed",
      errorMessage: `[${errorCode}] ${errorDetail}`,
      organizationId: opts.organizationId ?? null,
      triggeredBy: opts.triggeredBy ?? null,
      createdAt: new Date(),
    });

    return false;
  }
}
