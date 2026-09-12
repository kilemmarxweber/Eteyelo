import { resolveNotificationChannels } from "@/lib/notification-channels";
import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";
import { sendTransactionalWhatsApp } from "@/lib/zindua";

const APP_NAME = DEFAULT_APP_NAME;
const MAX_SUBJECT_LINES = 8;

export type StudentResultLine = {
  subject: string;
  score: number;
  maxScore: number;
};

export async function sendStudentResultsNotification(input: {
  to?: string | null;
  phone?: string | null;
  parentName: string;
  studentName: string;
  schoolName: string;
  className?: string | null;
  periodLabel: string;
  yearLabel: string;
  lines: StudentResultLine[];
  percentage: number;
  organizationId?: string | null;
}): Promise<{ emailSent: boolean; whatsappSent: boolean; whatsappError?: string }> {
  const email = input.to?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (!email && !phone) {
    return { emailSent: false, whatsappSent: false };
  }

  const allow = await resolveNotificationChannels(
    input.organizationId,
    "results",
  );
  if (!allow.email && !allow.whatsapp) {
    return { emailSent: false, whatsappSent: false };
  }

  const averageLabel = `${input.percentage.toFixed(1)}%`;
  const shown = input.lines.slice(0, MAX_SUBJECT_LINES);
  const extra = input.lines.length - shown.length;
  const subjectRows = shown.map((line) => ({
    label: line.subject,
    value: `${line.score}/${line.maxScore}`,
  }));
  if (extra > 0) {
    subjectRows.push({
      label: "Autres matières",
      value: `${extra} non listée${extra > 1 ? "s" : ""}`,
    });
  }

  const subject = `${APP_NAME} — Résultats de ${input.studentName}`;
  const intro = `Bonjour ${input.parentName}, voici les résultats de ${input.studentName}${
    input.className ? ` (${input.className})` : ""
  } pour ${input.periodLabel} — ${input.yearLabel}.`;

  const rows = [
    { label: "Établissement", value: input.schoolName },
    { label: "Élève", value: input.studentName },
    ...(input.className
      ? [{ label: "Classe", value: input.className }]
      : []),
    { label: "Période", value: `${input.periodLabel} — ${input.yearLabel}` },
    ...subjectRows,
    { label: "Moyenne", value: averageLabel },
  ];

  const text = [
    intro,
    "",
    ...rows.map((row) => `${row.label} : ${row.value}`),
    "",
    `Connectez-vous : ${getSignInUrl()}`,
    "",
    `— ${input.schoolName || APP_NAME}`,
  ].join("\n");

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Résultats scolaires",
    intro: escapeHtml(intro),
    bodyHtml: emailInfoCard(
      rows.map((row) => ({
        label: row.label,
        valueHtml: escapeHtml(row.value),
      })),
    ),
    cta: { href: getSignInUrl(), label: "Ouvrir mon compte" },
  });

  if (allow.email && email) {
    await sendMail({
      to: email,
      organizationId: input.organizationId,
      notificationEvent: "results",
      subject,
      text,
      html,
    });
  }

  let whatsappSent = false;
  let whatsappError: string | undefined;
  if (allow.whatsapp && phone) {
    const wa = await sendTransactionalWhatsApp({
      to: phone,
      organizationId: input.organizationId,
      parts: [
        input.schoolName,
        `Bonjour ${input.parentName},`,
        `résultats de ${input.studentName}${
          input.className ? ` (${input.className})` : ""
        } — ${input.periodLabel}.`,
        ...shown.map((line) => `${line.subject} : ${line.score}/${line.maxScore}`),
        extra > 0 ? `+ ${extra} autre${extra > 1 ? "s" : ""} matière${extra > 1 ? "s" : ""}` : null,
        `Moyenne : ${averageLabel}.`,
        `Détail : ${getSignInUrl()}`,
        `— ${input.schoolName || APP_NAME}`,
      ],
    });
    whatsappSent = wa.sent;
    whatsappError = wa.error;
  }

  return {
    emailSent: Boolean(allow.email && email),
    whatsappSent,
    whatsappError,
  };
}
