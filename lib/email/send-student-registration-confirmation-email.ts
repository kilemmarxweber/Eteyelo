import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendStudentRegistrationConfirmationEmail(input: {
  to: string;
  /** Téléphone parent/élève pour miroir WhatsApp. */
  phone?: string | null;
  recipientName: string;
  studentName: string;
  reference: string;
  branchName: string;
  requestedLevel?: string | null;
  organizationId?: string | null;
}): Promise<void> {
  const level = input.requestedLevel?.trim() || "Non précisé";
  const subject = `${APP_NAME} — Inscription reçue (${input.reference})`;
  const introText = `Bonjour ${input.recipientName}, votre demande d'inscription pour « ${input.studentName} » a bien été envoyée à l'établissement « ${input.branchName} ». Elle est enregistrée sous la référence ${input.reference} et sera examinée par l'école.`;

  const text = [
    `Bonjour ${input.recipientName},`,
    "",
    "Nous avons bien reçu votre demande d'inscription sur Klambocore.",
    "",
    `Référence : ${input.reference}`,
    `Élève / apprenant : ${input.studentName}`,
    `Établissement : ${input.branchName}`,
    `Classe / niveau souhaité : ${level}`,
    "",
    "Votre dossier a été transmis à l'établissement. Vous serez contacté dès qu'une suite sera donnée.",
    "",
    `— L'équipe ${APP_NAME}`,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      { label: "Référence", valueHtml: escapeHtml(input.reference) },
      {
        label: "Élève / apprenant",
        valueHtml: escapeHtml(input.studentName),
      },
      {
        label: "Établissement",
        valueHtml: escapeHtml(input.branchName),
      },
      {
        label: "Classe / niveau souhaité",
        valueHtml: escapeHtml(level),
      },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Votre dossier a été transmis à l'établissement. Vous serez contacté dès qu'une suite sera donnée.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Inscription bien reçue",
    intro: escapeHtml(introText),
    bodyHtml,
  });

  try {
    await sendMail({
      to: input.to,
      whatsappTo: input.phone,
      whatsappName: input.recipientName,
      organizationId: input.organizationId,
      subject,
      text,
      html,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Nodemailer: ${message}`);
  }
}
