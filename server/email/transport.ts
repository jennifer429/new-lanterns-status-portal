import nodemailer from "nodemailer";
import { ENV } from "../_core/env";

let transporter: nodemailer.Transporter | null = null;

export function getEmailTransport(): nodemailer.Transporter | null {
  if (!ENV.systemEmailAddress || !ENV.systemEmailAppPassword) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: ENV.systemEmailAddress,
        pass: ENV.systemEmailAppPassword.replace(/\s/g, ""),
      },
    });
  }
  return transporter;
}
