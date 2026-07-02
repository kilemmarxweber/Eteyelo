import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

// Configuration SMTP à partir des variables d'environnement
const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
const secure = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : port === 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.MAIL_FROM;

let transporter: Mail | null = null;

function createTransporter() {
  if (transporter) return transporter;

  // Vérifie que la configuration SMTP est complète
  if (!host || !user || !pass || !from) {
    throw new Error(
      "La configuration SMTP est incomplète. Veuillez définir SMTP_HOST, SMTP_USER, SMTP_PASS, et MAIL_FROM dans vos variables d'environnement.",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
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
  const mailFrom = from ?? process.env.MAIL_FROM;
  return t.sendMail({ from: mailFrom, to, subject, text, html });
}

export function isSmtpConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM
  );
}
