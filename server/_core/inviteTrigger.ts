import { ENV } from "./env";

export type InviteTriggerReason = "created" | "resent";

export type InviteTriggerContext = {
  email: string;
  reason: InviteTriggerReason;
  // Partner-admin addresses to CC on the invite. Only populated for
  // initial invites ("created"); resends do not carry a CC list.
  ccEmails?: string[];
};

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Notify the external invite automation (Render service) that a user has
 * just been created or had their invite reset, so it can fetch
 * /api/external/invites/pending and send the email immediately instead of
 * waiting for its next polling interval.
 *
 * Never throws: returns `true` when the webhook accepted the call, `false`
 * when it is not configured, times out, or returns a non-2xx response. The
 * caller should surface that flag to the UI so the toast wording can tell
 * admins whether the invite went out now or is queued for the next run.
 */
export async function triggerInviteSend(
  context: InviteTriggerContext
): Promise<boolean> {
  if (!ENV.inviteWebhookUrl) {
    return false;
  }

  // Explicit kill switch. When disabled we log what would have been sent and
  // return false so the UI falls back to the "queued for next automation run"
  // message — no email is dispatched.
  if (!ENV.inviteWebhookEnabled) {
    const ccSuffix =
      context.ccEmails && context.ccEmails.length > 0
        ? ` cc=[${context.ccEmails.join(", ")}]`
        : "";
    console.log(
      `[InviteTrigger] Disabled (INVITE_WEBHOOK_ENABLED!="true") — would have notified webhook for ${context.email} (${context.reason})${ccSuffix}`
    );
    return false;
  }

  try {
    const response = await fetch(ENV.inviteWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(ENV.inviteWebhookSecret
          ? { authorization: `Bearer ${ENV.inviteWebhookSecret}` }
          : {}),
      },
      body: JSON.stringify({
        email: context.email,
        reason: context.reason,
        ...(context.ccEmails && context.ccEmails.length > 0
          ? { ccEmails: context.ccEmails }
          : {}),
      }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[InviteTrigger] Webhook returned ${response.status} ${response.statusText}${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[InviteTrigger] Error calling invite webhook:", error);
    return false;
  }
}
