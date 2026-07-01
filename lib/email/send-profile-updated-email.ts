import { isSmtpConfigured, sendMail } from "./mailer";

const APP_NAME = process.env.APP_NAME ?? "Kalasa";

export async function sendProfileUpdatedEmail(input: {
  to: string;
  name: string;
}) {
  const subject = `${APP_NAME} - Votre profil a ete modifie`;
  const text = [
    `Bonjour ${input.name},`,
    "",
    "Les informations de votre profil viennent d'etre modifiees.",
    "",
    "Si vous n'etes pas a l'origine de cette modification, contactez rapidement l'administration.",
    "",
    `- L'equipe ${APP_NAME}`,
  ].join("\n");

  const html = `
    <p>Bonjour ${escapeHtml(input.name)},</p>
    <p>Les informations de votre profil viennent d'etre modifiees.</p>
    <p>Si vous n'etes pas a l'origine de cette modification, contactez rapidement l'administration.</p>
    <p>- ${escapeHtml(APP_NAME)}</p>
  `;

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
    console.info(`[sendProfileUpdatedEmail] to=${input.to}`);
  } else {
    console.warn(
      "[sendProfileUpdatedEmail] SMTP non configure : email non envoye.",
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
