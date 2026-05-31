import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";

describe("Email credentials validation", () => {
  it("should connect to Gmail SMTP with the configured credentials", async () => {
    const address = process.env.SYSTEM_EMAIL_ADDRESS;
    const password = process.env.SYSTEM_EMAIL_APP_PASSWORD;

    expect(address).toBeTruthy();
    expect(password).toBeTruthy();

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: address,
        pass: password,
      },
    });

    // verify() checks the SMTP connection and auth without sending an email
    const result = await transporter.verify();
    expect(result).toBe(true);
  }, 15000);

  it("should have display name and reply-to configured", () => {
    expect(process.env.SYSTEM_EMAIL_DISPLAY_NAME).toBe("New Lantern Portal");
    expect(process.env.SYSTEM_EMAIL_REPLY_TO).toBe("jennifer@newlantern.ai");
  });
});
