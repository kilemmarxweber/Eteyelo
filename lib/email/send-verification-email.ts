import { sendMail, isSmtpConfigured } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendVerificationEmail(input: {
  to: string;
  url: string;
  name?: string;
  subject?: string;
}): Promise<void> {
  const greeting = input.name?.trim() ? `Bonjour ${input.name.trim()}` : "Bonjour";
  const subject = input.subject ?? `${APP_NAME} — Confirmez votre adresse email`;
  const introText = `${greeting}, une dernière étape pour activer votre compte ${APP_NAME} : confirmez votre adresse email en cliquant sur le bouton ci-dessous.`;

  const text = [
    `${greeting},`,
    "",
    "Cliquez sur le lien ci-dessous pour confirmer votre adresse email :",
    input.url,
    "",
    "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.",
    "",
    `— L’équipe ${APP_NAME}`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Confirmez votre adresse email",
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: input.url, label: "Confirmer mon adresse email" },
  });

  const from =
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER
      ? `${APP_NAME} <${process.env.EMAIL_USER}>`
      : `no-reply@example.com`);

  if (isSmtpConfigured()) {
    try {
      await sendMail({ from, to: input.to, subject, text, html });
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Nodemailer: ${message}`);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(`[sendVerificationEmail] to=${input.to} url=${input.url}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.warn("[sendVerificationEmail] SMTP non configuré : email non envoyé.");
}
