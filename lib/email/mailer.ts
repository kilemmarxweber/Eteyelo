import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { isDeliverableMailbox } from "./deliverable-mailbox";
import { buildKlambocoreEmailLogoAttachment } from "./email-logo";
import {
  applySmtpFailure,
  isSmtpOutboundSuspended,
  logSmtpSkip,
} from "./smtp-circuit";

import type { NotificationEvent } from "@/lib/notification-channels-shared";

export type MailPayload = {
  from?: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Si fourni, envoie aussi le même contenu texte via WhatsApp (Zindua).
   * Indépendant du SMTP — les parents/élèves sont notifiés même sans email.
   */
  whatsappTo?: string | null;
  /** Nom destinataire pour {{name}} du template Zindua. */
  whatsappName?: string | null;
  /** Organisation : respecte le toggle WhatsApp des paramètres. */
  organizationId?: string | null;
  /** Si fourni, Mail / WhatsApp suivent la matrice Paramètres → Notifications. */
  notificationEvent?: NotificationEvent;
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
      pool: true,
      maxConnections: 1,
      maxMessages: 20,
      auth: {
        user,
        pass,
      },
    });

    return transporter;
  }

  throw new Error("SMTP non configuré.");
}

export function resetMailTransporter() {
  if (!transporter) return;
  try {
    transporter.close();
  } catch {
    // ignore
  }
  transporter = null;
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
  if (!isDeliverableMailbox(to)) {
    // eslint-disable-next-line no-console
    console.info(
      `[deliverMail] boîte inexistante — skip SMTP to=${to} subject=${subject}`,
    );
    return;
  }

  if (isSmtpOutboundSuspended()) {
    logSmtpSkip(to, subject);
    return;
  }

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

  try {
    return await t.sendMail({
      from: mailFrom,
      to,
      replyTo,
      subject,
      text,
      html,
      attachments: logoAttachment ? [logoAttachment] : undefined,
    });
  } catch (err) {
    if (applySmtpFailure(err)) {
      resetMailTransporter();
      logSmtpSkip(to, subject);
      return;
    }
    throw err;
  }
}

function queueWhatsAppMirror(payload: MailPayload): void {
  const phone = payload.whatsappTo?.trim();
  if (!phone) return;

  void (async () => {
    const { isWhatsAppSendingEnabled } = await import(
      "@/lib/whatsapp-settings"
    );
    if (!(await isWhatsAppSendingEnabled(payload.organizationId))) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.info(
          `[sendMail] WhatsApp désactivé — skip to=${phone} subject=${payload.subject}`,
        );
      }
      return;
    }
    const { mirrorEmailToWhatsApp } = await import("@/lib/zindua");
    await mirrorEmailToWhatsApp({
      to: phone,
      subject: payload.subject,
      body: payload.text,
      name: payload.whatsappName,
      organizationId: payload.organizationId,
    });
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendMail] WhatsApp mirror failed:",
      err instanceof Error ? err.message : err,
    );
  });
}

function stripMailJobPayload(payload: MailPayload) {
  const {
    whatsappTo: _wa,
    whatsappName: _wn,
    organizationId: _oid,
    notificationEvent: _ne,
    ...emailJob
  } = payload;
  return emailJob;
}

/**
 * Met l'email en file BullMQ (non bloquant pour la requête HTTP).
 * Si Redis est indisponible, envoi en arrière-plan sans attendre SMTP.
 * Si `whatsappTo` est fourni, miroir WhatsApp du texte (indépendant du SMTP).
 */
export async function sendMail(payload: MailPayload): Promise<void> {
  let allowEmail = true;
  let allowWhatsApp = true;
  if (payload.notificationEvent) {
    const { resolveNotificationChannels } = await import(
      "@/lib/notification-channels"
    );
    const allow = await resolveNotificationChannels(
      payload.organizationId,
      payload.notificationEvent,
    );
    allowEmail = allow.email;
    allowWhatsApp = allow.whatsapp;
  }

  if (allowWhatsApp) {
    queueWhatsAppMirror(payload);
  }

  if (!allowEmail) {
    return;
  }

  const emailTo = payload.to?.trim() ?? "";
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo);

  // WhatsApp seul (pas d'email parent/élève) — on s'arrête après le miroir.
  if (!hasValidEmail) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendMail] email invalide/absent — WhatsApp only subject=${payload.subject}`,
      );
    }
    return;
  }

  // Identifiants @klambocore.com générés (sauf contact@ / kilem@) : pas de SMTP.
  if (!isDeliverableMailbox(emailTo)) {
    // eslint-disable-next-line no-console
    console.info(
      `[sendMail] boîte inexistante — WhatsApp only to=${emailTo} subject=${payload.subject}`,
    );
    return;
  }

  if (isSmtpOutboundSuspended()) {
    logSmtpSkip(emailTo, payload.subject);
    return;
  }

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendMail] SMTP off — skip queue to=${emailTo} subject=${payload.subject}`,
      );
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[sendMail] SMTP non configuré : email non mis en file (to=${emailTo}).`,
    );
    return;
  }

  try {
    const { getEmailQueue } = await import("@/src/redis/queues/email.queue");
    const { ensureRedisReady } = await import("@/src/redis/redis");
    await ensureRedisReady();

    await getEmailQueue().add("send-email", stripMailJobPayload(payload), {
      jobId: undefined,
    });
  } catch (error) {
    // Redis down / queue ko : ne bloque pas l'utilisateur, envoi async.
    // eslint-disable-next-line no-console
    console.warn(
      "[sendMail] File email indisponible, fallback envoi background:",
      error instanceof Error ? error.message : error,
    );
    const emailOnly = stripMailJobPayload(payload);
    void deliverMail(emailOnly).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        "[sendMail] Fallback SMTP failed:",
        err instanceof Error ? err.message : err,
      );
    });
  }
}
