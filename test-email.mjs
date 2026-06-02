import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.SYSTEM_EMAIL_ADDRESS;
const pass = process.env.SYSTEM_EMAIL_APP_PASSWORD?.replace(/\s/g, "");

console.log("=== SMTP Diagnostic ===");
console.log("From account:", user);
console.log("Password length:", pass?.length || 0);
console.log("Password (masked):", pass ? pass.slice(0, 4) + "****" + pass.slice(-4) : "MISSING");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
});

console.log("\n1. Verifying SMTP connection...");
try {
  await transporter.verify();
  console.log("   ✅ SMTP connection verified — credentials are valid");
} catch (err) {
  console.error("   ❌ SMTP verification FAILED:", err.message);
  console.error("   This means the email/password combo is rejected by Gmail.");
  console.error("   Fix: Generate a new App Password at https://myaccount.google.com/apppasswords");
  process.exit(1);
}

console.log("\n2. Sending test email to jennifer@newlantern.ai...");
try {
  const info = await transporter.sendMail({
    from: `"NL Test" <${user}>`,
    to: "jennifer@newlantern.ai",
    subject: "SMTP Test — " + new Date().toISOString(),
    text: "If you receive this, SMTP is working correctly.",
    html: "<p>If you receive this, <b>SMTP is working correctly</b>.</p>",
  });
  console.log("   ✅ Sent! Message ID:", info.messageId);
  console.log("   Response:", info.response);
  console.log("   Accepted:", info.accepted);
  console.log("   Rejected:", info.rejected);
} catch (err) {
  console.error("   ❌ Send FAILED:", err.message);
  console.error("   Full error:", err);
}
