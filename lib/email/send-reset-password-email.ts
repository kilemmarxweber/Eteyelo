import { sendMail, isSmtpConfigured } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendResetPasswordEmail(input: {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl?: string;
}): Promise<void> {
  const { to, name, temporaryPassword } = input;
  const loginUrl = input.loginUrl ?? getSignInUrl();

  const subject = `${APP_NAME} — Réinitialisation de votre mot de passe`;
  const introText = `Bonjour ${name}, votre mot de passe ${APP_NAME} a été réinitialisé par un administrateur. Utilisez le mot de passe temporaire ci-dessous pour vous reconnecter sur klambocore.com.`;

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

  const bodyHtml = `
    ${emailInfoCard([
      { label: "Email", valueHtml: escapeHtml(to) },
      {
        label: "Nouveau mot de passe",
        valueHtml: `<code style="background:#e2e8f0;padding:2px 8px;border-radius:6px;font-size:13px;">${escapeHtml(temporaryPassword)}</code>`,
      },
      {
        label: "Connexion",
        valueHtml: `<a href="${escapeHtml(loginUrl)}" style="color:#1d4ed8;text-decoration:none;">klambocore.com</a>`,
      },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Pour des raisons de sécurité, changez ce mot de passe après connexion.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Mot de passe réinitialisé",
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: loginUrl, label: "Se connecter sur Klambocore" },
  });

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
    // eslint-disable-next-line no-console
    console.info(`[RESET EMAIL] to=${to}`);
    // eslint-disable-next-line no-console
    console.info(`[RESET PASSWORD] ${temporaryPassword}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn("[RESET EMAIL] SMTP non configuré");
  }
}
