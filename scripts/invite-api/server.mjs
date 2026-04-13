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

function buildHtml({ name, email, orgName, setPasswordUrl, dashboardUrl }) {
  const displayName = name || email;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:8px;color:#1a3c5e">You're invited to New Lanterns</h2>
  <p style="color:#555">Hi ${displayName},</p>
  <p style="color:#555">
    ${orgName
      ? `You've been added to <strong>${orgName}</strong> on the New Lanterns Status Portal.`
      : "You've been added to the New Lanterns Status Portal."}
    Please set a password to activate your account.
  </p>
  <a href="${setPasswordUrl}"
     style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1a3c5e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
    Set Your Password
  </a>
  <p style="color:#888;font-size:13px">
    This link expires in <strong>7 days</strong>. Once you've set your password, you can access
    your dashboard at: <a href="${dashboardUrl}" style="color:#1a3c5e">${dashboardUrl}</a>
  </p>
  <p style="font-size:13px;color:#666">
    Or copy this link into your browser:<br>
    <a href="${setPasswordUrl}">${setPasswordUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#aaa;font-size:12px">
    If you didn't expect this invitation, you can safely ignore this email.
  </p>
</body>
</html>`;
}

function buildText({ name, email, orgName, setPasswordUrl, dashboardUrl }) {
  const displayName = name || email;
  return [
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
}

async function sendInviteEmail(user) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD not configured");

  await transporter.sendMail({
    from: `"New Lanterns" <${GMAIL_USER}>`,
    to: user.email,
    subject: "You're invited to New Lanterns — set your password",
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
