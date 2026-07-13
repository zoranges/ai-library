import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP not configured — emails will be logged to console');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendResetPasswordEmail(to: string, resetLink: string): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    console.log(`[Email] Reset link for ${to}: ${resetLink}`);
    return false;
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'AI Library - Password Reset',
      html: `
        <div style="max-width:480px;margin:0 auto;padding:24px;font-family:Arial,sans-serif">
          <h2 style="color:#3b82f6">AI Library</h2>
          <h3>Password Reset Request</h3>
          <p>You requested to reset your password. Click the button below to set a new password:</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">Reset Password</a>
          <p style="color:#888;font-size:13px">This link expires in 1 hour. If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
    console.log(`[Email] Reset password email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    console.log(`[Email] Verification code for ${to}: ${code}`);
    return false;
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'AI Library - Email Verification',
      html: `
        <div style="max-width:480px;margin:0 auto;padding:24px;font-family:Arial,sans-serif">
          <h2 style="color:#3b82f6">AI Library</h2>
          <h3>Verify Your Email</h3>
          <p>Your verification code is:</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:4px;padding:12px 24px;background:#f3f4f6;border-radius:8px;text-align:center;margin:16px 0">${code}</div>
          <p style="color:#888;font-size:13px">This code expires in 10 minutes.</p>
        </div>
      `,
    });
    console.log(`[Email] Verification email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}
