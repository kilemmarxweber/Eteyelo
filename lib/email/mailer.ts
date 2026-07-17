import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { buildKlambocoreEmailLogoAttachment } from "./email-logo";
let transporter: Mail | null = null;

function createTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return transporter;
  }

  throw new Error("SMTP non configuré.");
}

export function getDefaultMailFrom() {
  const appName = process.env.APP_NAME ?? "Klambocore";
  const smtpUser = process.env.SMTP_USER?.trim();

  if (!smtpUser) {
    return undefined;
  }

  return `${appName} <${smtpUser}>`;
}

export async function sendMail({
  from,
  to,
  replyTo,
  subject,
  text,
  html,
}: {
  from?: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const t = createTransporter();
  if (!t) {
    throw new Error("Le transporteur d'email n'a pas pu être initialisé.");
  }
  const mailFrom = from ?? getDefaultMailFrom();
  if (!mailFrom) {
    throw new Error(
      "Aucune adresse d'expéditeur configurée (SMTP_USER manquant).",
    );
  }

  const logoAttachment = html ? buildKlambocoreEmailLogoAttachment() : null;

  return t.sendMail({
    from: mailFrom,
    to,
    replyTo,
    subject,
    text,
    html,
    attachments: logoAttachment ? [logoAttachment] : undefined,
  });
}

export function isSmtpConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}
