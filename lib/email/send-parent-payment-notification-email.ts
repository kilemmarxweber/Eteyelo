import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export type ParentPaymentNotifyKind = "created" | "updated" | "deleted";

const COPY: Record<
  ParentPaymentNotifyKind,
  { title: string; intro: string; subject: string }
> = {
  created: {
    title: "Paiement enregistré",
    intro: "Un paiement vient d’être enregistré pour votre famille.",
    subject: "Paiement enregistré",
  },
  updated: {
    title: "Paiement modifié",
    intro:
      "Un paiement de votre famille vient d’être modifié par l’établissement.",
    subject: "Paiement modifié",
  },
  deleted: {
    title: "Paiement annulé",
    intro: "Un paiement de votre famille a été supprimé (erreur de saisie).",
    subject: "Paiement annulé",
  },
};

export async function sendParentPaymentNotificationEmail(input: {
  to?: string | null;
  phone?: string | null;
  parentName: string;
  schoolName: string;
  kind: ParentPaymentNotifyKind;
  reference: string;
  amountLabel: string;
  studentNames: string;
  feeNames?: string;
}): Promise<void> {
  const email = input.to?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (!email && !phone) return;

  const copy = COPY[input.kind];
  const subject = `${APP_NAME} — ${copy.subject}`;
  const intro = `Bonjour ${input.parentName}, ${copy.intro}`;
  const rows = [
    { label: "Établissement", value: input.schoolName },
    { label: "Référence", value: input.reference },
    { label: "Montant", value: input.amountLabel },
    { label: "Élève(s)", value: input.studentNames || "—" },
    ...(input.feeNames ? [{ label: "Frais", value: input.feeNames }] : []),
  ];

  const text = [
    intro,
    "",
    ...rows.map((row) => `${row.label} : ${row.value}`),
    "",
    "Connectez-vous à votre compte pour consulter le détail.",
    "",
    `— ${APP_NAME}`,
  ].join("\n");

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: copy.title,
    intro: escapeHtml(intro),
    bodyHtml: emailInfoCard(
      rows.map((row) => ({
        label: row.label,
        valueHtml: escapeHtml(row.value),
      })),
    ),
    cta: {
      href: getSignInUrl(),
      label: "Ouvrir mon compte",
    },
  });

  await sendMail({
    to: email,
    whatsappTo: phone || null,
    whatsappName: input.parentName,
    subject,
    text,
    html,
  });
}
