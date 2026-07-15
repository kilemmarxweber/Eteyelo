import { sendMail, isSmtpConfigured } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

/**
 * Envoie (ou journalise) les identifiants temporaires après création de compte par un admin.
 * Configurez `EMAIL_USER` et `EMAIL_PASS` pour l’envoi réel via SMTP.
 */
export async function sendNewUserCredentialsEmail(input: {
  to: string;
  name: string;
  temporaryPassword: string;
  role?: string;
  organizationName?: string;
  branchName?: string;
  branchPhone?: string;
  branchAddress?: string;
  loginUrl?: string;
}): Promise<void> {
  const { to, name, temporaryPassword } = input;
  const role = input.role?.trim() || "Utilisateur";
  const organizationName = input.organizationName?.trim();
  const branchName = input.branchName?.trim();
  const branchPhone = input.branchPhone?.trim();
  const branchAddress = input.branchAddress?.trim();
  const loginUrl = input.loginUrl ?? getSignInUrl();

  const contextParts = [
    `rôle « ${role} »`,
    organizationName ? `organisation « ${organizationName} »` : null,
    branchName ? `branche « ${branchName} »` : null,
  ].filter(Boolean);

  const subject = `${APP_NAME} — Votre compte a été créé`;
  const introText = `Bonjour ${name}, un administrateur vient de créer votre compte ${APP_NAME} avec le ${contextParts.join(", ")}. Vos identifiants temporaires sont prêts : connectez-vous sur klambocore.com puis changez votre mot de passe.`;

  const text = [
    `Bonjour ${name},`,
    "",
    `Un administrateur a créé votre compte ${APP_NAME} avec le ${contextParts.join(", ")}.`,
    "",
    `Email de connexion : ${to}`,
    `Rôle : ${role}`,
    ...(organizationName ? [`Organisation : ${organizationName}`] : []),
    ...(branchName ? [`Branche : ${branchName}`] : []),
    ...(branchPhone ? [`Téléphone branche : ${branchPhone}`] : []),
    ...(branchAddress ? [`Adresse branche : ${branchAddress}`] : []),
    `Mot de passe temporaire : ${temporaryPassword}`,
    "",
    `Connectez-vous ici : ${loginUrl}`,
    "",
    "Pour des raisons de sécurité, changez ce mot de passe après votre première connexion.",
    "",
    "— L’équipe " + APP_NAME,
  ].join("\n");

  const infoRows = [
    { label: "Email", valueHtml: escapeHtml(to) },
    { label: "Rôle", valueHtml: escapeHtml(role) },
    ...(organizationName
      ? [
          {
            label: "Organisation",
            valueHtml: escapeHtml(organizationName),
          },
        ]
      : []),
    ...(branchName
      ? [{ label: "Branche", valueHtml: escapeHtml(branchName) }]
      : []),
    ...(branchPhone
      ? [
          {
            label: "Téléphone branche",
            valueHtml: `<a href="tel:${escapeHtml(branchPhone)}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(branchPhone)}</a>`,
          },
        ]
      : []),
    {
      label: "Mot de passe temporaire",
      valueHtml: `<code style="background:#e2e8f0;padding:2px 8px;border-radius:6px;font-size:13px;">${escapeHtml(temporaryPassword)}</code>`,
    },
    {
      label: "Connexion",
      valueHtml: `<a href="${escapeHtml(loginUrl)}" style="color:#1d4ed8;text-decoration:none;">klambocore.com</a>`,
    },
  ];

  const bodyHtml = `
    ${emailInfoCard(infoRows)}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Pour des raisons de sécurité, changez ce mot de passe après votre première connexion.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Votre compte a été créé",
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: loginUrl, label: "Se connecter sur Klambocore" },
    branchContact: {
      name: branchName,
      phone: branchPhone,
      address: branchAddress,
    },
  });

  const from =
    process.env.MAIL_FROM ??
    process.env.EMAIL_FROM ??
    (process.env.SMTP_USER
      ? `${APP_NAME} <${process.env.SMTP_USER}>`
      : undefined);

  if (!from) {
    throw new Error("Aucun expéditeur configuré.");
  }

  if (isSmtpConfigured()) {
    try {
      await sendMail({ from, to, subject, text, html });
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Nodemailer: ${message}`);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(
      `[sendNewUserCredentialsEmail] to=${to} role=${role} org=${organizationName ?? "-"} branch=${branchName ?? "-"} (dev, pas de SMTP configuré)`,
    );
    // eslint-disable-next-line no-console
    console.info(
      `[sendNewUserCredentialsEmail] mot de passe temporaire (dev uniquement) : ${temporaryPassword}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendNewUserCredentialsEmail] SMTP non configuré : email non envoyé (production).",
    );
  }
}
