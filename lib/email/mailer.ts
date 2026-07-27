import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { buildKlambocoreEmailLogoAttachment } from "./email-logo";

export type MailPayload = {
  from?: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
};

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

export function isSmtpConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

/** Envoi SMTP immédiat (utilisé par le worker email). */
export async function deliverMail({
  from,
  to,
  replyTo,
  subject,
  text,
  html,
}: MailPayload) {
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

/**
 * Met l'email en file BullMQ (non bloquant pour la requête HTTP).
 * Si Redis est indisponible, envoi en arrière-plan sans attendre SMTP.
 */
export async function sendMail(payload: MailPayload): Promise<void> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendMail] SMTP off — skip queue to=${payload.to} subject=${payload.subject}`,
      );
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[sendMail] SMTP non configuré : email non mis en file (to=${payload.to}).`,
    );
    return;
  }

  try {
    const { getEmailQueue } = await import("@/src/redis/queues/email.queue");
    const redis = (await import("@/src/redis/redis")).getRedisConnection();

    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }

    await getEmailQueue().add("send-email", payload, {
      jobId: undefined,
    });
  } catch (error) {
    // Redis down / queue ko : ne bloque pas l'utilisateur, envoi async.
    // eslint-disable-next-line no-console
    console.warn(
      "[sendMail] File email indisponible, fallback envoi background:",
      error instanceof Error ? error.message : error,
    );
    void deliverMail(payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        "[sendMail] Fallback SMTP failed:",
        err instanceof Error ? err.message : err,
      );
    });
  }
}
