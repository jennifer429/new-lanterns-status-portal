import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { z } from "zod";
import nodemailer from "nodemailer";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE_URL  = process.env.API_BASE_URL  || "https://newlantern.us.com";
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;
const GMAIL_USER    = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const PORT          = parseInt(process.env.PORT || "3000", 10);

if (!EXTERNAL_API_KEY) {
  console.error("EXTERNAL_API_KEY is required");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${EXTERNAL_API_KEY}` },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EXTERNAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

function buildInviteHtml(email, setPasswordUrl) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:40px auto;color:#222">
  <h2 style="color:#1a3c5e">You're invited to New Lantern</h2>
  <p>Hello,</p>
  <p>An account has been created for <strong>${email}</strong>. Click the button below to set your password and get started.</p>
  <p style="margin:32px 0">
    <a href="${setPasswordUrl}"
       style="background:#1a3c5e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
      Set My Password
    </a>
  </p>
  <p style="font-size:13px;color:#666">
    Or copy this link into your browser:<br>
    <a href="${setPasswordUrl}">${setPasswordUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
  <p style="font-size:12px;color:#999">New Lantern &middot; newlantern.us.com</p>
</body>
</html>`;
}

async function sendEmail(to, setPasswordUrl) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD are required to send emails");
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: `"New Lantern" <${GMAIL_USER}>`,
    to,
    subject: "You're invited to New Lantern — set your password",
    html: buildInviteHtml(to, setPasswordUrl),
  });
}

// ── MCP Server ────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "newlantern",
  version: "1.0.0",
});

// Tool 1: get pending invites
server.tool(
  "get_pending_invites",
  "Returns all users who have not yet been sent an invitation email (invitedAt is null and isActive is true).",
  {},
  async () => {
    const data = await apiGet("/api/external/invites/pending");
    const users = data.pendingInvites ?? [];
    if (users.length === 0) {
      return { content: [{ type: "text", text: "No pending invites — all users have already been invited." }] };
    }
    const lines = users.map((u) =>
      `• [${u.userId}] ${u.name} <${u.email}> (${u.role})${u.orgName ? ` — ${u.orgName}` : ""}${u.partnerName ? ` [${u.partnerName}]` : ""}\n  Set password: ${u.setPasswordUrl}\n  Dashboard: ${u.dashboardUrl}`
    );
    return {
      content: [{
        type: "text",
        text: `${users.length} pending invite(s):\n\n${lines.join("\n\n")}`,
      }],
    };
  }
);

// Tool 2: mark a single invite as sent
server.tool(
  "mark_invite_sent",
  "Stamps invitedAt for a user after their invitation email has been sent. Pass the numeric user ID (from get_pending_invites).",
  { userId: z.number().describe("The numeric user ID to mark as invited") },
  async ({ userId }) => {
    const result = await apiPost("/api/external/invites/mark-sent", { userIds: [userId] });
    return { content: [{ type: "text", text: `Marked user ${userId} as invited (${result.marked} updated).` }] };
  }
);

// Tool 3: send invite email to one user
server.tool(
  "send_invite_email",
  "Sends the branded HTML invitation email to a single user. Requires GMAIL_USER and GMAIL_APP_PASSWORD to be configured on the server.",
  {
    email: z.string().email().describe("Recipient email address"),
    setPasswordUrl: z.string().url().describe("The set-password URL for this user"),
    userId: z.number().describe("The numeric user ID (used to mark as sent after emailing)"),
  },
  async ({ email, setPasswordUrl, userId }) => {
    await sendEmail(email, setPasswordUrl);
    await apiPost("/api/external/invites/mark-sent", { userIds: [userId] });
    return { content: [{ type: "text", text: `Invite email sent to ${email} and marked as sent.` }] };
  }
);

// Tool 4: full send-all flow
server.tool(
  "send_all_pending_invites",
  "Runs the full three-step flow: fetches all pending users, sends each a branded invite email, then marks them as sent. Requires Gmail credentials on the server.",
  {},
  async () => {
    const data = await apiGet("/api/external/invites/pending");
    const users = data.pendingInvites ?? [];

    if (users.length === 0) {
      return { content: [{ type: "text", text: "No pending invites to send." }] };
    }

    const results = [];
    const sentIds = [];
    for (const u of users) {
      try {
        await sendEmail(u.email, u.setPasswordUrl);
        sentIds.push(u.userId);
        results.push(`✓ ${u.email}`);
      } catch (err) {
        results.push(`✗ ${u.email} — ${err.message}`);
      }
    }

    // Batch mark-sent for all successful sends
    if (sentIds.length > 0) {
      try {
        const markResult = await apiPost("/api/external/invites/mark-sent", { userIds: sentIds });
        results.push(`\nMarked ${markResult.marked} user(s) as invited.`);
      } catch (err) {
        results.push(`\nWARN: mark-sent failed — ${err.message}. Invites may re-send next run.`);
      }
    }

    return {
      content: [{
        type: "text",
        text: `Processed ${users.length} user(s):\n\n${results.join("\n")}`,
      }],
    };
  }
);

// ── HTTP transport (Streamable HTTP — what Claude.ai expects) ─────────────────
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await server.connect(transport);

const httpServer = createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "newlantern-mcp" }));
    return;
  }

  // All MCP traffic goes to /mcp
  if (req.url === "/mcp" || req.url === "/") {
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`New Lantern MCP server listening on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
