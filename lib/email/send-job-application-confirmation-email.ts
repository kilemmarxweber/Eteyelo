import { sendMail, isSmtpConfigured } from "./mailer";

const APP_NAME = process.env.APP_NAME ?? "Klambocore";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

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

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:560px">
      <p>Bonjour <strong>${escapeHtml(input.candidateName)}</strong>,</p>
      <p>Nous avons bien reçu votre candidature sur <strong>${escapeHtml(APP_NAME)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#64748b">Référence</td><td style="padding:8px 0"><strong>${escapeHtml(input.reference)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Type de poste</td><td style="padding:8px 0">${escapeHtml(roleLabel)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Établissement</td><td style="padding:8px 0">${escapeHtml(input.branchName)}</td></tr>
      </table>
      <p>Votre dossier sera examiné par l'établissement. Vous serez contacté par email en cas de suite favorable.</p>
      <p style="margin-top:24px;color:#64748b">— L'équipe ${escapeHtml(APP_NAME)}</p>
    </div>
  `;

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
