import {
  dayGreetingMessageKey,
  getMessagingTranslator,
  resolveDayGreetingPeriod,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";
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
export type BranchSubmissionDetailKind =
  | "candidateEmail"
  | "desiredLevel"
  | "desiredLevels";

export async function sendBranchSubmissionNotificationEmail(input: {
  to: string | string[];
  kind: BranchSubmissionKind;
  reference: string;
  branchName: string;
  submitterName: string;
  subjectName?: string;
  detailKind?: BranchSubmissionDetailKind;
  detailValue?: string;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}): Promise<void> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (recipients.length === 0) return;

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const isInscription = input.kind === "inscription";
  const title = isInscription
    ? t("branchSubmission.inscriptionTitle")
    : t("branchSubmission.candidatureTitle");
  const subject = t("branchSubmission.subject", {
    app: APP_NAME,
    title,
    reference: input.reference,
  });
  const greeting = t(dayGreetingMessageKey(resolveDayGreetingPeriod()));
  const hello = t("common.helloBare", { greeting });
  const introBody = isInscription
    ? t("branchSubmission.inscriptionIntro", {
        school: input.branchName,
        reference: input.reference,
      })
    : t("branchSubmission.candidatureIntro", {
        school: input.branchName,
        reference: input.reference,
      });
  const introText = `${hello} ${introBody}`.trim();
  const bodyLead = isInscription
    ? t("branchSubmission.inscriptionBody", { school: input.branchName })
    : t("branchSubmission.candidatureBody", { school: input.branchName });
  const submitterLabel = isInscription
    ? t("branchSubmission.submitterInscription")
    : t("branchSubmission.submitterCandidature");
  const subjectLabel = isInscription
    ? t("branchSubmission.subjectInscription")
    : t("branchSubmission.subjectCandidature");

  const detailLabel =
    input.detailKind === "candidateEmail"
      ? t("branchSubmission.candidateEmail")
      : input.detailKind === "desiredLevels"
        ? t("branchSubmission.desiredLevels")
        : input.detailKind === "desiredLevel"
          ? t("branchSubmission.desiredLevel")
          : null;

  const detailRows = [
    { label: t("common.reference"), valueHtml: escapeHtml(input.reference) },
    {
      label: t("common.school"),
      valueHtml: escapeHtml(input.branchName),
    },
    {
      label: submitterLabel,
      valueHtml: escapeHtml(input.submitterName),
    },
  ];

  if (input.subjectName) {
    detailRows.push({
      label: subjectLabel,
      valueHtml: escapeHtml(input.subjectName),
    });
  }

  if (detailLabel && input.detailValue) {
    detailRows.push({
      label: detailLabel,
      valueHtml: escapeHtml(input.detailValue),
    });
  }

  const textLines = [
    hello,
    "",
    bodyLead,
    "",
    `${t("common.reference")} : ${input.reference}`,
    `${submitterLabel} : ${input.submitterName}`,
  ];

  if (input.subjectName) {
    textLines.push(`${subjectLabel} : ${input.subjectName}`);
  }
  if (detailLabel && input.detailValue) {
    textLines.push(`${detailLabel} : ${input.detailValue}`);
  }

  textLines.push(
    "",
    t("branchSubmission.adminHint"),
    "",
    t("common.signatureApp", { app: APP_NAME }),
  );

  const text = textLines.join("\n");
  const adminUrl = getSignInUrl("/admin");

  const bodyHtml = `
    ${emailInfoCard(detailRows)}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("branchSubmission.adminHintHtml"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title,
    intro: escapeHtml(introText),
    bodyHtml,
    cta: {
      href: adminUrl,
      label: t("common.openAdmin"),
    },
  });

  if (isSmtpConfigured()) {
    try {
      await Promise.all(
        recipients.map((to) =>
          sendMail({
            to,
            subject,
            text,
            html,
            organizationId: input.organizationId,
            locale,
          }),
        ),
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
