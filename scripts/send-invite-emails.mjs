#!/usr/bin/env node
/**
 * Send invite emails to all pending users.
 *
 * Required env vars:
 *   API_BASE_URL        — Base URL of the portal (e.g. https://newlantern.us.com)
 *   EXTERNAL_API_KEY    — Bearer token for /api/external/* endpoints
 *   GMAIL_USER          — Gmail address to send from (e.g. noreply@newlantern.us.com)
 *   GMAIL_APP_PASSWORD  — Gmail App Password (16-char, spaces OK)
 *
 * Usage:
 *   API_BASE_URL=https://newlantern.us.com \
 *   EXTERNAL_API_KEY=<key> \
 *   GMAIL_USER=you@gmail.com \
 *   GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx" \
 *   node scripts/send-invite-emails.mjs
 *
 * Dry-run (no emails sent, no mark-sent call):
 *   DRY_RUN=1 node scripts/send-invite-emails.mjs
 */

import nodemailer from "nodemailer";

const {
  API_BASE_URL = "https://newlantern.us.com",
  EXTERNAL_API_KEY,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  DRY_RUN,
} = process.env;

// ─── Validate env ────────────────────────────────────────────────────────────
if (!EXTERNAL_API_KEY) {
  console.error("ERROR: EXTERNAL_API_KEY is required.");
  process.exit(1);
}
if (!DRY_RUN && (!GMAIL_USER || !GMAIL_APP_PASSWORD)) {
  console.error(
    "ERROR: GMAIL_USER and GMAIL_APP_PASSWORD are required (or set DRY_RUN=1)."
  );
  process.exit(1);
}

const isDryRun = Boolean(DRY_RUN);
const apiHeaders = {
  Authorization: `Bearer ${EXTERNAL_API_KEY}`,
  "Content-Type": "application/json",
};

// ─── Fetch pending invites ────────────────────────────────────────────────────
console.log(`\nFetching pending invites from ${API_BASE_URL}…`);

let pending;
try {
  const res = await fetch(`${API_BASE_URL}/api/external/invites/pending`, {
    headers: apiHeaders,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`ERROR: ${res.status} ${res.statusText}\n${body}`);
    process.exit(1);
  }

  pending = await res.json();
} catch (err) {
  console.error("ERROR: Could not reach the API:", err.message);
  process.exit(1);
}

if (!pending.length) {
  console.log("No pending invites. All done!");
  process.exit(0);
}

console.log(`Found ${pending.length} user(s) to invite:\n`);
for (const u of pending) {
  console.log(`  • [${u.userId}] ${u.name ?? "(no name)"} <${u.email}>`);
  console.log(`    Role: ${u.role}  Org: ${u.orgName ?? "—"}  Partner: ${u.partnerName ?? "—"}`);
  console.log(`    Set-password URL: ${u.setPasswordUrl}`);
  console.log(`    Dashboard URL:    ${u.dashboardUrl}\n`);
}

if (isDryRun) {
  console.log("DRY_RUN=1 — skipping email send and mark-sent.");
  process.exit(0);
}

// ─── Configure Gmail transport ───────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD.replace(/\s/g, ""),
  },
});

// ─── Send each invite ─────────────────────────────────────────────────────────
const sentIds = [];

for (const user of pending) {
  const { userId, name, email, orgName, setPasswordUrl, dashboardUrl } = user;
  const displayName = name ?? email;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
  <img src="https://newlantern.us.com/logo.png" alt="New Lanterns" style="height:40px;margin-bottom:24px">

  <h2 style="margin-bottom:8px">You're invited to New Lanterns</h2>
  <p style="color:#555">Hi ${displayName},</p>

  <p style="color:#555">
    ${orgName ? `You've been added to <strong>${orgName}</strong> on the New Lanterns Status Portal.` : "You've been added to the New Lanterns Status Portal."}
    Please set a password to activate your account.
  </p>

  <a href="${setPasswordUrl}"
     style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
    Set Your Password
  </a>

  <p style="color:#888;font-size:13px">
    This link expires in <strong>7 days</strong>. Once you've set your password, you can access
    your dashboard at: <a href="${dashboardUrl}" style="color:#1a1a1a">${dashboardUrl}</a>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#aaa;font-size:12px">
    If you didn't expect this invitation, you can safely ignore this email.
  </p>
</body>
</html>
`;

  const text = [
    `Hi ${displayName},`,
    "",
    orgName
      ? `You've been added to ${orgName} on the New Lanterns Status Portal.`
      : "You've been added to the New Lanterns Status Portal.",
    "Please set a password to activate your account:",
    "",
    setPasswordUrl,
    "",
    "This link expires in 7 days.",
    `Once activated, your dashboard is at: ${dashboardUrl}`,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `"New Lanterns" <${GMAIL_USER}>`,
      to: email,
      subject: "You're invited to New Lanterns — set your password",
      text,
      html,
    });
    console.log(`✓ Email sent to ${email}`);
    sentIds.push(userId);
  } catch (err) {
    console.error(`✗ Failed to send to ${email}: ${err.message}`);
  }
}

// ─── Mark sent ────────────────────────────────────────────────────────────────
if (sentIds.length) {
  const res = await fetch(`${API_BASE_URL}/api/external/invites/mark-sent`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ userIds: sentIds }),
  });

  if (res.ok) {
    const { marked } = await res.json();
    console.log(`\n✓ Marked ${marked} invite(s) as sent.`);
  } else {
    console.error(`\nWARN: mark-sent returned ${res.status} — invites may re-send next run.`);
  }
}

console.log("\nDone.");
