import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

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
  const appName = process.env.APP_NAME ?? "Kalasa Edu";

  return (
    process.env.MAIL_FROM ??
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER
      ? `${appName} <${process.env.EMAIL_USER}>`
      : undefined)
  );
}

export async function sendMail({
  from,
  to,
  subject,
  text,
  html,
}: {
  from?: string;
  to: string;
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
    throw new Error("Aucune adresse d'expéditeur configurée.");
  }

  return t.sendMail({ from: mailFrom, to, subject, text, html });
}

export function isSmtpConfigured() {
  return !!(
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
    (process.env.EMAIL_USER && process.env.EMAIL_PASS)
  );
}
