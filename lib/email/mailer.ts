import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

let transporter: Mail | null = null;

function createTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (host && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: smtpUser, pass: smtpPass },
    });
    return transporter;
  }

  if (emailUser && emailPass) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
    });
    return transporter;
  }

  throw new Error(
    "La configuration email est incomplète. Définissez SMTP_HOST/SMTP_USER/SMTP_PASS ou EMAIL_USER/EMAIL_PASS.",
  );
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
    (process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS) ||
    (process.env.EMAIL_USER && process.env.EMAIL_PASS)
  );
}
