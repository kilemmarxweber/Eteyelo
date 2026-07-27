import { sendMail, isSmtpConfigured } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export type BranchSubmissionKind = "inscription" | "candidature";

export async function sendBranchSubmissionNotificationEmail(input: {
  to: string | string[];
  kind: BranchSubmissionKind;
  reference: string;
  branchName: string;
  submitterName: string;
  subjectName?: string;
  detailLabel?: string;
  detailValue?: string;
}): Promise<void> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (recipients.length === 0) return;

  const isInscription = input.kind === "inscription";
  const kindLabel = isInscription ? "inscription" : "candidature";
  const title = isInscription
    ? "Nouvelle demande d'inscription"
    : "Nouvelle candidature reçue";
  const subject = `${APP_NAME} — ${title} (${input.reference})`;
  const introText = isInscription
    ? `Bonjour, une nouvelle demande d'inscription a été envoyée à « ${input.branchName} » via Klambocore. Référence ${input.reference}.`
    : `Bonjour, une nouvelle candidature a été envoyée à « ${input.branchName} » via Klambocore. Référence ${input.reference}.`;

  const detailRows = [
    { label: "Référence", valueHtml: escapeHtml(input.reference) },
    {
      label: "Établissement",
      valueHtml: escapeHtml(input.branchName),
    },
    {
      label: isInscription ? "Responsable / déposant" : "Candidat",
      valueHtml: escapeHtml(input.submitterName),
    },
  ];

  if (input.subjectName) {
    detailRows.push({
      label: isInscription ? "Élève / apprenant" : "Poste concerné",
      valueHtml: escapeHtml(input.subjectName),
    });
  }

  if (input.detailLabel && input.detailValue) {
    detailRows.push({
      label: input.detailLabel,
      valueHtml: escapeHtml(input.detailValue),
    });
  }

  const textLines = [
    "Bonjour,",
    "",
    `Une nouvelle ${kindLabel} a été déposée pour « ${input.branchName} ».`,
    "",
    `Référence : ${input.reference}`,
    `${isInscription ? "Responsable / déposant" : "Candidat"} : ${input.submitterName}`,
  ];

  if (input.subjectName) {
    textLines.push(
      `${isInscription ? "Élève / apprenant" : "Poste concerné"} : ${input.subjectName}`,
    );
  }
  if (input.detailLabel && input.detailValue) {
    textLines.push(`${input.detailLabel} : ${input.detailValue}`);
  }

  textLines.push(
    "",
    "Connectez-vous à votre espace administration pour examiner le dossier.",
    "",
    `— ${APP_NAME}`,
  );

  const text = textLines.join("\n");
  const adminUrl = getSignInUrl("/admin");

  const bodyHtml = `
    ${emailInfoCard(detailRows)}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Connectez-vous à votre espace administration pour examiner et traiter ce dossier.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title,
    intro: escapeHtml(introText),
    bodyHtml,
    cta: {
      href: adminUrl,
      label: "Ouvrir l'administration",
    },
  });

  if (isSmtpConfigured()) {
    try {
      await Promise.all(
        recipients.map((to) => sendMail({ to, subject, text, html })),
      );
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Nodemailer: ${message}`);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(
      `[sendBranchSubmissionNotificationEmail] kind=${input.kind} to=${recipients.join(",")} ref=${input.reference}`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[sendBranchSubmissionNotificationEmail] SMTP non configuré : email non envoyé.",
  );
}
