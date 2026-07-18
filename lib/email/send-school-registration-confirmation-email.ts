import type { ManagedBranchType } from "@/lib/academic-structure";
import { getBranchTypeLabel } from "@/lib/branch-capabilities";
import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  KLAMBOCORE_LOGIN_URL,
} from "./email-layout";

type SchoolRegistrationConfirmationInput = {
  appName?: string;
  to: string;
  schoolName: string;
  reference: string;
  typebranch: ManagedBranchType;
};

function formatBranchType(type: ManagedBranchType) {
  return getBranchTypeLabel(type);
}

export function schoolRegistrationConfirmationTemplate(
  input: SchoolRegistrationConfirmationInput,
) {
  const appName = input.appName ?? DEFAULT_APP_NAME;
  const branchType = formatBranchType(input.typebranch);
  const introText = `Bonjour, nous avons bien reçu votre demande de création d'établissement pour « ${input.schoolName} ». Votre dossier est enregistré sous la référence ${input.reference} et sera examiné par l'équipe Klambocore avant la mise en ligne sur la plateforme.`;

  const text = [
    "Bonjour,",
    "",
    `Nous avons bien reçu votre demande de création d'établissement sur ${appName}.`,
    "",
    `Référence : ${input.reference}`,
    `Établissement : ${input.schoolName}`,
    `Type : ${branchType}`,
    "",
    "Votre demande sera examinée par Klambocore. Vous serez contacté par email ou téléphone une fois la décision prise et l'établissement créé sur la plateforme.",
    "",
    `— L'équipe ${appName}`,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      { label: "Référence", valueHtml: escapeHtml(input.reference) },
      {
        label: "Établissement",
        valueHtml: escapeHtml(input.schoolName),
      },
      { label: "Type", valueHtml: escapeHtml(branchType) },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Votre demande de création d'établissement sera examinée par Klambocore.
      Vous serez contacté par email ou téléphone dès que l'établissement sera
      validé et créé sur la plateforme.
    </p>
  `;

  const html = emailLayoutHtml({
    appName,
    title: "Demande de création d'établissement reçue",
    intro: escapeHtml(introText),
    bodyHtml,
    cta: {
      href: KLAMBOCORE_LOGIN_URL,
      label: "Visiter Klambocore",
    },
  });

  return {
    subject: `${appName} — Demande de création reçue (${input.reference})`,
    text,
    html,
  };
}

export async function sendSchoolRegistrationConfirmationEmail(
  input: SchoolRegistrationConfirmationInput,
): Promise<void> {
  const { subject, text, html } = schoolRegistrationConfirmationTemplate(input);

  await sendMail({
    to: input.to,
    subject,
    text,
    html,
  });
}
