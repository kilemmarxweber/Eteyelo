import { sendMail, isSmtpConfigured } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendJobApplicationConfirmationEmail(input: {
  to: string;
  candidateName: string;
  reference: string;
  applicationType: "TEACHER" | "PERSONNEL";
  branchName: string;
}): Promise<void> {
  const roleLabel =
    input.applicationType === "TEACHER" ? "Enseignant" : "Personnel";
  const subject = `${APP_NAME} — Candidature reçue (${input.reference})`;
  const introText = `Bonjour ${input.candidateName}, nous avons bien reçu votre candidature ${roleLabel.toLowerCase()} pour « ${input.branchName} ». Votre dossier est enregistré sous la référence ${input.reference} et sera examiné par l’établissement.`;

  const text = [
    `Bonjour ${input.candidateName},`,
    "",
    "Nous avons bien reçu votre candidature sur Klambocore.",
    "",
    `Référence : ${input.reference}`,
    `Type de poste : ${roleLabel}`,
    `Établissement : ${input.branchName}`,
    "",
    "Votre dossier sera examiné par l'établissement. Vous serez contacté par email en cas de suite favorable.",
    "",
    `— L'équipe ${APP_NAME}`,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      { label: "Référence", valueHtml: escapeHtml(input.reference) },
      { label: "Type de poste", valueHtml: escapeHtml(roleLabel) },
      { label: "Établissement", valueHtml: escapeHtml(input.branchName) },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Votre dossier sera examiné par l’établissement. Vous serez contacté par email en cas de suite favorable.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Candidature bien reçue",
    intro: escapeHtml(introText),
    bodyHtml,
  });

  const from =
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER
      ? `${APP_NAME} <${process.env.EMAIL_USER}>`
      : `no-reply@klambocore.com`);

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
    console.info(
      `[sendJobApplicationConfirmationEmail] to=${input.to} ref=${input.reference}`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[sendJobApplicationConfirmationEmail] SMTP non configuré : email non envoyé.",
  );
}
