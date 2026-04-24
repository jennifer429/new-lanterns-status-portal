import express from "express";
import nodemailer from "nodemailer";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE_URL     = process.env.API_BASE_URL || "https://newlantern.us.com";
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;
const GMAIL_USER       = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const PORT             = parseInt(process.env.PORT || "3000", 10);

if (!EXTERNAL_API_KEY) {
  console.error("EXTERNAL_API_KEY is required");
  process.exit(1);
}

// ── Portal API client ─────────────────────────────────────────────────────────

async function portalGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${EXTERNAL_API_KEY}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body };
  return body;
}

async function portalPost(path, payload) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EXTERNAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body };
  return body;
}

// ── Email ─────────────────────────────────────────────────────────────────────

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

function buildSubject({ orgName }) {
  if (orgName) return `New Lantern - ${orgName} - Implementation Portal — Action Required`;
  return "New Lantern - Implementation Portal — Action Required";
}

function buildHtml({ name, email, orgName, setPasswordUrl, dashboardUrl }) {
  const displayName = name || email;
  const orgLabel = orgName || "your organization";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:32px 40px">
            <div style="font-size:20px;font-weight:700;color:#ffffff;margin-bottom:16px">New Lantern</div>
            <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:4px">Implementation Portal &mdash; Action Required</div>
            ${orgName ? `<div style="font-size:16px;color:#a78bfa;margin-top:8px">${orgName}</div>` : ""}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${displayName},</p>

            <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px">
              You have been set up with access to the <strong>New Lantern Implementation Portal</strong> for <strong>${orgLabel}</strong>.
              We need your help completing a few remaining items in the portal before go-live. Most of
              the setup is already done &mdash; we just need you to log in and upload some key files.
            </p>

            <!-- Login Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #7c3aed;border-radius:8px;margin:0 0 32px">
              <tr><td style="padding:24px 28px">
                <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:12px">First: Set Up Your Login</div>

                <p style="font-size:14px;color:#444;margin:0 0 16px">
                  Click the button below to create your password and access the portal:
                </p>

                <ol style="font-size:14px;color:#444;line-height:1.8;margin:0 0 20px;padding-left:20px">
                  <li>Click the button below to set your password</li>
                  <li>Choose a strong password (6+ characters)</li>
                  <li>Log in and you'll see your ${orgLabel} implementation portal</li>
                </ol>

                <a href="${setPasswordUrl}"
                   style="display:inline-block;padding:14px 28px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
                  Set Password &amp; Log In
                </a>
              </td></tr>
            </table>

            <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px">
              Your dashboard will show your implementation progress. Please complete the questionnaire by
              uploading files for users, procedure codes, templates, and a phone directory.
            </p>

            <!-- Reminders -->
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
              <a href="mailto:support@newlantern.us.com" style="color:#7c3aed">support@newlantern.us.com</a>
            </p>

            <p style="font-size:15px;color:#444;margin:24px 0 4px">Thank you for your help getting these last items completed.</p>
            <p style="font-size:15px;color:#444;margin:0">Best,<br><strong>Jennifer</strong></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb">
            <p style="font-size:12px;color:#999;margin:0;text-align:center">
              &copy; 2026 New Lantern, Inc. &nbsp;|&nbsp;
              <a href="mailto:support@newlantern.us.com" style="color:#999">support@newlantern.us.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText({ name, email, orgName, setPasswordUrl, dashboardUrl }) {
  const displayName = name || email;
  const orgLabel = orgName || "your organization";
  return [
    `Hi ${displayName},`,
    "",
    `You have been set up with access to the New Lantern Implementation Portal for ${orgLabel}.`,
    "We need your help completing a few remaining items in the portal before go-live.",
    "Most of the setup is already done — we just need you to log in and upload some key files.",
    "",
    "SET UP YOUR LOGIN",
    "─────────────────",
    "Click this link to set your password and access the portal:",
    setPasswordUrl,
    "",
    "1. Click the link above to set your password",
    "2. Choose a strong password (6+ characters)",
    `3. Log in and you'll see your ${orgLabel} implementation portal`,
    "",
    "IMPORTANT REMINDERS",
    "─────────────────",
    "• This link expires in 7 days. Contact us if you need a new one.",
    "• Do not share your login credentials with others.",
    "• Do not upload or include Protected Health Information (PHI) in the portal.",
    "",
    "If you have questions, contact: support@newlantern.us.com",
    "",
    "Thank you for your help getting these last items completed.",
    "",
    "Best,",
    "Jennifer",
    "",
    `Your dashboard: ${dashboardUrl}`,
    "",
    "© 2026 New Lantern, Inc. | support@newlantern.us.com",
  ].join("\n");
}

async function sendInviteEmail(user) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD not configured");

  await transporter.sendMail({
    from: `"Jennifer Starling" <${GMAIL_USER}>`,
    to: user.email,
    subject: buildSubject(user),
    text: buildText(user),
    html: buildHtml(user),
  });
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "newlantern-invite-api",
    gmailConfigured: !!(GMAIL_USER && GMAIL_APP_PASSWORD),
    portalUrl: API_BASE_URL,
  });
});

// ── GET /invites/pending ──────────────────────────────────────────────────────
// Returns all users who haven't been invited yet.
// Query params: ?role=user|admin  (optional filter)
app.get("/invites/pending", async (req, res) => {
  try {
    const data = await portalGet("/api/external/invites/pending");
    let invites = data.pendingInvites || [];

    // Optional role filter
    if (req.query.role) {
      invites = invites.filter(u => u.role === req.query.role);
    }

    res.json({
      count: invites.length,
      invites,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: "Failed to fetch pending invites", detail: err.body || err.message });
  }
});

// ── POST /invites/send ────────────────────────────────────────────────────────
// Send invite email to a single user by userId.
// Body: { userId: number }
// Or: { email: string } (looks up from pending list)
app.post("/invites/send", async (req, res) => {
  try {
    const { userId, email } = req.body;
    if (!userId && !email) {
      return res.status(400).json({ error: "Provide userId or email" });
    }

    // Fetch pending to find the user and their set-password URL
    const data = await portalGet("/api/external/invites/pending");
    const invites = data.pendingInvites || [];

    const user = userId
      ? invites.find(u => u.userId === userId)
      : invites.find(u => u.email === email);

    if (!user) {
      return res.status(404).json({ error: "User not found in pending invites", hint: "User may have already been invited" });
    }

    // Send email
    await sendInviteEmail(user);

    // Mark as sent
    const markResult = await portalPost("/api/external/invites/mark-sent", { userIds: [user.userId] });

    res.json({
      sent: true,
      userId: user.userId,
      email: user.email,
      name: user.name,
      marked: markResult.marked,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: "Failed to send invite", detail: err.body || err.message });
  }
});

// ── POST /invites/send-all ────────────────────────────────────────────────────
// Sends invite emails to ALL pending users, then marks them as sent.
// Body (optional): { dryRun: true } — returns what would be sent without sending.
app.post("/invites/send-all", async (req, res) => {
  try {
    const dryRun = req.body?.dryRun === true;

    const data = await portalGet("/api/external/invites/pending");
    const invites = data.pendingInvites || [];

    if (invites.length === 0) {
      return res.json({ count: 0, message: "No pending invites", results: [] });
    }

    if (dryRun) {
      return res.json({
        dryRun: true,
        count: invites.length,
        wouldSend: invites.map(u => ({
          userId: u.userId,
          email: u.email,
          name: u.name,
          role: u.role,
          orgName: u.orgName,
          partnerName: u.partnerName,
        })),
      });
    }

    // Send each email
    const results = [];
    const sentIds = [];

    for (const user of invites) {
      try {
        await sendInviteEmail(user);
        sentIds.push(user.userId);
        results.push({ userId: user.userId, email: user.email, status: "sent" });
      } catch (err) {
        results.push({ userId: user.userId, email: user.email, status: "failed", error: err.message });
      }
    }

    // Batch mark-sent
    let marked = 0;
    if (sentIds.length > 0) {
      try {
        const markResult = await portalPost("/api/external/invites/mark-sent", { userIds: sentIds });
        marked = markResult.marked;
      } catch (err) {
        results.push({ status: "warn", message: "mark-sent failed — invites may re-send next run", error: err.message });
      }
    }

    res.json({
      count: invites.length,
      sent: sentIds.length,
      failed: invites.length - sentIds.length,
      marked,
      results,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: "Failed to process invites", detail: err.body || err.message });
  }
});

// ── GET /invites/status ───────────────────────────────────────────────────────
// Summary of invite system state.
app.get("/invites/status", async (req, res) => {
  try {
    const data = await portalGet("/api/external/invites/pending");
    const invites = data.pendingInvites || [];

    const byRole = {};
    const byPartner = {};
    for (const u of invites) {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
      const partner = u.partnerName || "(platform)";
      byPartner[partner] = (byPartner[partner] || 0) + 1;
    }

    res.json({
      pendingCount: invites.length,
      byRole,
      byPartner,
      gmailConfigured: !!(GMAIL_USER && GMAIL_APP_PASSWORD),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: "Failed to fetch status", detail: err.body || err.message });
  }
});

// ── GET /orgs ─────────────────────────────────────────────────────────────────
// List all organizations from the portal.
app.get("/orgs", async (_req, res) => {
  try {
    const data = await portalGet("/api/external/orgs");
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Failed to fetch orgs", detail: err.body || err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`New Lanterns Invite API listening on port ${PORT}`);
  console.log(`  Portal:  ${API_BASE_URL}`);
  console.log(`  Gmail:   ${GMAIL_USER ? GMAIL_USER : "(not configured — send disabled)"}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health`);
  console.log(`  GET  /invites/pending      Query pending invites`);
  console.log(`  GET  /invites/status       Summary stats`);
  console.log(`  POST /invites/send         Send to one user { userId } or { email }`);
  console.log(`  POST /invites/send-all     Send to all pending { dryRun?: true }`);
  console.log(`  GET  /orgs                 List all organizations`);
});
