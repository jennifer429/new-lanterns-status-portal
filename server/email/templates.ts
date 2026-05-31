import { ENV } from "../_core/env";

const SITE_URL = ENV.siteBaseUrl || "https://newlantern.us.com";
const SUPPORT_EMAIL = ENV.systemEmailReplyTo || "support@newlantern.ai";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">

        <tr>
          <td style="background:#1a1a2e;padding:32px 40px">
            <div style="font-size:20px;font-weight:700;color:#ffffff">New Lantern</div>
          </td>
        </tr>

        <tr>
          <td style="padding:40px">
            ${content}
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb">
            <p style="font-size:12px;color:#999;margin:0;text-align:center">
              &copy; 2026 New Lantern, Inc. &nbsp;|&nbsp;
              <a href="mailto:${SUPPORT_EMAIL}" style="color:#999">${SUPPORT_EMAIL}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function inviteTemplate(params: {
  displayName: string;
  orgName: string | null;
  setPasswordUrl: string;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const orgLabel = params.orgName || "your organization";
  const subject = params.orgName
    ? `New Lantern - ${params.orgName} - Implementation Portal — Action Required`
    : "New Lantern - Implementation Portal — Action Required";

  const html = baseLayout(`
    <div style="font-size:22px;font-weight:700;color:#1a1a2e;margin-bottom:4px">Implementation Portal &mdash; Action Required</div>
    ${params.orgName ? `<div style="font-size:15px;color:#7c3aed;margin-bottom:24px">${params.orgName}</div>` : '<div style="margin-bottom:24px"></div>'}

    <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${params.displayName},</p>

    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px">
      You have been set up with access to the <strong>New Lantern Implementation Portal</strong> for <strong>${orgLabel}</strong>.
      We need your help completing a few remaining items in the portal before go-live. Most of
      the setup is already done &mdash; we just need you to log in and upload some key files.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #7c3aed;border-radius:8px;margin:0 0 32px">
      <tr><td style="padding:24px 28px">
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:12px">First: Set Up Your Login</div>
        <p style="font-size:14px;color:#444;margin:0 0 16px">Click the button below to create your password and access the portal:</p>
        <ol style="font-size:14px;color:#444;line-height:1.8;margin:0 0 20px;padding-left:20px">
          <li>Click the button below to set your password</li>
          <li>Choose a strong password (6+ characters)</li>
          <li>Log in and you'll see your ${orgLabel} implementation portal</li>
        </ol>
        <a href="${params.setPasswordUrl}"
           style="display:inline-block;padding:14px 28px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
          Set Password &amp; Log In
        </a>
      </td></tr>
    </table>

    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px">
      Your dashboard will show your implementation progress. Please complete the questionnaire by
      uploading files for users, procedure codes, templates, and a phone directory.
    </p>

    <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:20px 24px;margin:0 0 32px">
      <div style="font-size:15px;font-weight:700;color:#92400e;margin-bottom:12px">Important Reminders</div>
      <ul style="font-size:14px;color:#78350f;line-height:1.8;margin:0;padding-left:20px">
        <li>This link expires in <strong>7 days</strong>. Contact us if you need a new one.</li>
        <li>Do not share your login credentials with others.</li>
        <li>Do not upload or include Protected Health Information (PHI) in the portal.</li>
      </ul>
    </div>

    <p style="font-size:14px;color:#666;margin:0 0 8px">
      If you have questions or run into any issues, please contact:<br>
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed">${SUPPORT_EMAIL}</a>
    </p>

    <p style="font-size:15px;color:#444;margin:24px 0 4px">Thank you for your help getting these last items completed.</p>
    <p style="font-size:15px;color:#444;margin:0">Best,<br><strong>Jennifer</strong></p>
  `);

  const text = [
    `Hi ${params.displayName},`,
    "",
    `You have been set up with access to the New Lantern Implementation Portal for ${orgLabel}.`,
    "We need your help completing a few remaining items in the portal before go-live.",
    "Most of the setup is already done — we just need you to log in and upload some key files.",
    "",
    "SET UP YOUR LOGIN",
    "Click this link to set your password and access the portal:",
    params.setPasswordUrl,
    "",
    "1. Click the link above to set your password",
    "2. Choose a strong password (6+ characters)",
    `3. Log in and you'll see your ${orgLabel} implementation portal`,
    "",
    "IMPORTANT REMINDERS",
    "- This link expires in 7 days. Contact us if you need a new one.",
    "- Do not share your login credentials with others.",
    "- Do not upload or include Protected Health Information (PHI) in the portal.",
    "",
    `If you have questions, contact: ${SUPPORT_EMAIL}`,
    "",
    "Thank you for your help getting these last items completed.",
    "",
    "Best,",
    "Jennifer",
    "",
    `Your dashboard: ${params.dashboardUrl}`,
    "",
    `© 2026 New Lantern, Inc. | ${SUPPORT_EMAIL}`,
  ].join("\n");

  return { subject, html, text };
}

export function reminderTemplate(params: {
  displayName: string;
  reminderType: "password" | "questionnaire" | "task";
  actionUrl: string;
  orgName?: string | null;
  details?: string;
}): { subject: string; html: string; text: string } {
  const subjects: Record<string, string> = {
    password: "Reminder: Set your New Lantern password",
    questionnaire: "Reminder: Complete your onboarding questionnaire",
    task: "Reminder: You have outstanding tasks",
  };
  const bodies: Record<string, string> = {
    password: "You haven't set your password yet. Please complete your account setup to access the portal.",
    questionnaire: "Your onboarding questionnaire has incomplete sections. Please complete them at your earliest convenience.",
    task: "You have outstanding tasks that need attention.",
  };

  const subject = subjects[params.reminderType];
  const html = baseLayout(`
    <div style="font-size:22px;font-weight:700;color:#1a1a2e;margin-bottom:24px">Action Required</div>
    <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${params.displayName},</p>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px">${bodies[params.reminderType]}</p>
    ${params.details ? `<p style="font-size:14px;color:#555;margin:0 0 16px">${params.details}</p>` : ""}
    <a href="${params.actionUrl}"
       style="display:inline-block;margin:20px 0;padding:14px 28px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
      Take Action
    </a>
    <p style="font-size:14px;color:#666;margin:24px 0 8px">
      Questions? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed">${SUPPORT_EMAIL}</a>
    </p>
    <p style="font-size:15px;color:#444;margin:0">Best,<br><strong>Jennifer</strong></p>
  `);

  const text = [
    `Hi ${params.displayName},`,
    "",
    bodies[params.reminderType],
    params.details || "",
    "",
    params.actionUrl,
    "",
    `Questions? Contact ${SUPPORT_EMAIL}`,
    "",
    "Best,",
    "Jennifer",
  ].join("\n");

  return { subject, html, text };
}
