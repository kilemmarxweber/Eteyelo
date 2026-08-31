import { emailInfoCard, emailLayoutHtml, escapeHtml } from "@/lib/email/email-layout";
import { sendMail } from "@/lib/email/mailer";
import { CURRENCY_LABELS } from "@/lib/exchange-rate";
import type { CurrencyCode } from "@/prisma/generated/prisma/client";

export async function sendPayrollDeductionEmail(input: {
  to?: string | null;
  recipientName: string;
  branchName: string;
  contextLabel: string;
  occurredOn: Date;
  statusLabel: string;
  deduction: number;
  currency: CurrencyCode;
  rule: string;
  organizationId?: string | null;
}) {
  if (!input.to) return;
  const amount = `${input.deduction.toLocaleString("fr-FR")} ${CURRENCY_LABELS[input.currency]}`;
  const date = input.occurredOn.toLocaleDateString("fr-FR");
  const text = [
    `Bonjour ${input.recipientName},`,
    "",
    `Un événement de présence peut impacter votre paie : ${input.statusLabel}.`,
    `Établissement : ${input.branchName}`,
    `Séance : ${input.contextLabel}`,
    `Date : ${date}`,
    `Retenue estimée : ${amount}`,
    `Règle : ${input.rule}`,
    "",
    "Le montant définitif figure sur le bulletin de paie du mois.",
  ].join("\n");
  const html = emailLayoutHtml({
    appName: "Eteyelo",
    title: "Impact sur la paie",
    intro: `Bonjour ${input.recipientName}, un événement de présence peut impacter votre paie.`,
    bodyHtml: emailInfoCard([
      { label: "Établissement", valueHtml: escapeHtml(input.branchName) },
      { label: "Séance", valueHtml: escapeHtml(input.contextLabel) },
      { label: "Date", valueHtml: escapeHtml(date) },
      { label: "Statut", valueHtml: escapeHtml(input.statusLabel) },
      { label: "Retenue estimée", valueHtml: escapeHtml(amount) },
      { label: "Règle", valueHtml: escapeHtml(input.rule) },
    ]),
    footerNote: "Le montant définitif figure sur le bulletin de paie du mois.",
  });
  await sendMail({
    to: input.to,
    subject: `Impact paie — ${input.statusLabel}`,
    text,
    html,
    organizationId: input.organizationId,
  });
}
