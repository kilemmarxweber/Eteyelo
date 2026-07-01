import { sendMail, isSmtpConfigured } from "./mailer";

const APP_NAME = process.env.APP_NAME ?? "Kalasa";

export async function sendResetPasswordEmail(input: {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl?: string;
}): Promise<void> {
  const { to, name, temporaryPassword } = input;

  const loginUrl =
    input.loginUrl ??
    `${
      process.env.BETTER_AUTH_URL ??
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
      "http://localhost:3000"
    }/auth/sign-in`;

  const subject = `${APP_NAME} — Réinitialisation de votre mot de passe`;

  const text = [
    `Bonjour ${name},`,
    "",
    "Votre mot de passe a été réinitialisé par un administrateur.",
    "",
    `Email : ${to}`,
    `Nouveau mot de passe temporaire : ${temporaryPassword}`,
    "",
    `Connectez-vous ici : ${loginUrl}`,
    "",
    "Nous vous recommandons de modifier ce mot de passe après connexion.",
    "",
    "— L’équipe " + APP_NAME,
  ].join("\n");

  const html = `
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Votre mot de passe a été réinitialisé par un administrateur.</p>

    <ul>
      <li><strong>Email</strong> : ${escapeHtml(to)}</li>
      <li><strong>Nouveau mot de passe</strong> : <code>${escapeHtml(
        temporaryPassword,
      )}</code></li>
    </ul>

    <p>
      <a href="${escapeHtml(loginUrl)}">Se connecter</a>
    </p>

    <p>
      Pour des raisons de sécurité, changez ce mot de passe après connexion.
    </p>

    <p>— ${escapeHtml(APP_NAME)}</p>
  `;

  const from =
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER
      ? `${APP_NAME} <${process.env.EMAIL_USER}>`
      : "no-reply@example.com");

  if (isSmtpConfigured()) {
    await sendMail({ from, to, subject, text, html });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.info(`[RESET EMAIL] to=${to}`);
    console.info(`[RESET PASSWORD] ${temporaryPassword}`);
  } else {
    console.warn("[RESET EMAIL] SMTP non configuré");
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
