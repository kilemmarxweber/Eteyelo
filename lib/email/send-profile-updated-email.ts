import { isSmtpConfigured, sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendProfileUpdatedEmail(input: {
  to: string;
  name: string;
}) {
  const subject = `${APP_NAME} — Votre profil a été modifié`;
  const introText = `Bonjour ${input.name}, les informations de votre profil ${APP_NAME} viennent d’être mises à jour. Si cette modification ne vient pas de vous, contactez rapidement l’administration.`;
  const loginUrl = getSignInUrl();

  const text = [
    `Bonjour ${input.name},`,
    "",
    "Les informations de votre profil viennent d’être modifiées.",
    "",
    "Si vous n’êtes pas à l’origine de cette modification, contactez rapidement l’administration.",
    "",
    `— L’équipe ${APP_NAME}`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Vous pouvez vérifier vos informations en vous connectant à votre espace sur
      <a href="${escapeHtml(loginUrl)}" style="color:#1d4ed8;text-decoration:none;">klambocore.com</a>.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Profil mis à jour",
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: loginUrl, label: "Voir mon profil" },
  });

  const from =
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER
      ? `${APP_NAME} <${process.env.EMAIL_USER}>`
      : "no-reply@example.com");

  if (isSmtpConfigured()) {
    await sendMail({ from, to: input.to, subject, text, html });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(`[sendProfileUpdatedEmail] to=${input.to}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendProfileUpdatedEmail] SMTP non configuré : email non envoyé.",
    );
  }
}
