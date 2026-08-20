import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

type AbsenceEmailKind =
  | "absence"
  | "justification_submitted"
  | "justification_received"
  | "accepted"
  | "rejected"
  | "return";

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
  }).format(date);
}

async function sendAbsenceMail(input: {
  to?: string | null;
  phone?: string | null;
  recipientName: string;
  subject: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  note?: string;
  ctaLabel?: string;
}): Promise<void> {
  const email = input.to?.trim();
  if (!email && !input.phone) return;

  const text = [
    `Bonjour ${input.recipientName},`,
    "",
    input.intro,
    "",
    ...input.rows.map((row) => `${row.label} : ${row.value}`),
    input.note ? `\n${input.note}` : "",
    "",
    `— L'équipe ${APP_NAME}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const bodyHtml = `
    ${emailInfoCard(
      input.rows.map((row) => ({
        label: row.label,
        valueHtml: escapeHtml(row.value),
      })),
    )}
    ${
      input.note
        ? `<p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">${escapeHtml(input.note)}</p>`
        : ""
    }
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: input.title,
    intro: escapeHtml(input.intro),
    bodyHtml,
    cta: input.ctaLabel
      ? { href: getSignInUrl("/auth/sign-in"), label: input.ctaLabel }
      : undefined,
  });

  try {
    await sendMail({
      to: email || "undisclosed@klambocore.com",
      whatsappTo: input.phone,
      whatsappName: input.recipientName,
      subject: input.subject,
      text,
      html,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sendAbsenceNotificationEmail] ${message}`);
  }
}

export async function sendAbsenceLifecycleEmail(input: {
  kind: AbsenceEmailKind;
  to?: string | null;
  phone?: string | null;
  recipientName: string;
  personName: string;
  branchName: string;
  contextLabel: string;
  occurredOn: Date;
  subjectLabel: string;
  justification?: string | null;
  reviewComment?: string | null;
}): Promise<void> {
  const dateLabel = formatDateLabel(input.occurredOn);
  const rows = [
    { label: "Établissement", value: input.branchName },
    { label: "Personne", value: input.personName },
    { label: "Qualité", value: input.subjectLabel },
    { label: "Date", value: dateLabel },
    { label: "Séance", value: input.contextLabel },
  ];
  if (input.justification?.trim()) {
    rows.push({ label: "Justification", value: input.justification.trim() });
  }
  if (input.reviewComment?.trim()) {
    rows.push({ label: "Décision", value: input.reviewComment.trim() });
  }

  const copy: Record<
    AbsenceEmailKind,
    { subject: string; title: string; intro: string; note: string; cta: string }
  > = {
    absence: {
      subject: `${APP_NAME} — Absence signalée`,
      title: "Absence signalée",
      intro: `Bonjour ${input.recipientName}, une absence a été enregistrée automatiquement (aucun scan ni pointage manuel) pour « ${input.personName} ». Merci de vous connecter pour justifier.`,
      note: "Cliquez sur la cloche dans la barre de navigation pour voir le détail et envoyer votre justification.",
      cta: "Ouvrir mon espace",
    },
    justification_submitted: {
      subject: `${APP_NAME} — Justification d'absence reçue`,
      title: "Justification reçue",
      intro: `Bonjour ${input.recipientName}, votre justification d'absence a bien été transmise à l'établissement « ${input.branchName} ». Vous serez notifié de la décision.`,
      note: "La réponse apparaîtra aussi à la cloche de votre barre de navigation.",
      cta: "Voir mon espace",
    },
    justification_received: {
      subject: `${APP_NAME} — Justification d'absence à examiner`,
      title: "Justification à examiner",
      intro: `Bonjour ${input.recipientName}, ${input.personName} a justifié une absence. Merci d'examiner le dossier depuis la cloche de notifications.`,
      note: "Acceptez ou refusez la justification depuis la cloche. Un retour est signalé automatiquement si elle est acceptée.",
      cta: "Examiner",
    },
    accepted: {
      subject: `${APP_NAME} — Justification d'absence acceptée`,
      title: "Justification acceptée",
      intro: `Bonjour ${input.recipientName}, votre justification d'absence a été acceptée par l'établissement « ${input.branchName} ».`,
      note: "Un retour a également été signalé dans votre compte.",
      cta: "Voir le détail",
    },
    rejected: {
      subject: `${APP_NAME} — Justification d'absence refusée`,
      title: "Justification refusée",
      intro: `Bonjour ${input.recipientName}, votre justification d'absence n'a pas été retenue par l'établissement « ${input.branchName} ».`,
      note: "Consultez la cloche pour le motif de la décision.",
      cta: "Voir le détail",
    },
    return: {
      subject: `${APP_NAME} — Retour après absence`,
      title: "Retour signalé",
      intro: `Bonjour ${input.recipientName}, un retour a été enregistré dans votre compte suite à l'acceptation de votre justification.`,
      note: "L'absence est désormais marquée comme excusée.",
      cta: "Voir mon espace",
    },
  };

  const selected = copy[input.kind];
  await sendAbsenceMail({
    to: input.to,
    phone: input.phone,
    recipientName: input.recipientName,
    subject: selected.subject,
    title: selected.title,
    intro: selected.intro,
    rows,
    note: selected.note,
    ctaLabel: selected.cta,
  });
}
