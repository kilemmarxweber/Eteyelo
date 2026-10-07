import type { ManagedBranchType } from "@/lib/academic-structure";
import { getBranchTypeLabel } from "@/lib/branch-capabilities";
import {
  dayGreetingMessageKey,
  getMessagingTranslator,
  resolveDayGreetingPeriod,
  type MessagingLocale,
} from "@/lib/messaging-locale";
import { normalizeUserLocale } from "@/lib/user-locale";
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
  locale?: MessagingLocale | null;
};

export async function schoolRegistrationConfirmationTemplate(
  input: SchoolRegistrationConfirmationInput,
) {
  const appName = input.appName ?? DEFAULT_APP_NAME;
  const locale = normalizeUserLocale(input.locale);
  const t = await getMessagingTranslator(locale);
  const branchType = getBranchTypeLabel(input.typebranch);
  const greeting = t(dayGreetingMessageKey(resolveDayGreetingPeriod()));
  const hello = t("common.helloBare", { greeting });
  const introText = `${hello} ${t("schoolRegistration.intro", {
    school: input.schoolName,
    reference: input.reference,
  })}`.trim();

  const text = [
    hello,
    "",
    t("schoolRegistration.bodyLead", { app: appName }),
    "",
    `${t("common.reference")} : ${input.reference}`,
    `${t("common.school")} : ${input.schoolName}`,
    `${t("common.type")} : ${branchType}`,
    "",
    t("schoolRegistration.note"),
    "",
    `klambocore.com`,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      {
        label: t("common.reference"),
        valueHtml: escapeHtml(input.reference),
      },
      {
        label: t("common.school"),
        valueHtml: escapeHtml(input.schoolName),
      },
      { label: t("common.type"), valueHtml: escapeHtml(branchType) },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("schoolRegistration.note"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName,
    title: t("schoolRegistration.title"),
    intro: escapeHtml(introText),
    bodyHtml,
    cta: {
      href: KLAMBOCORE_LOGIN_URL,
      label: t("common.visitKlambo"),
    },
  });

  return {
    subject: t("schoolRegistration.subject", {
      app: appName,
      reference: input.reference,
    }),
    text,
    html,
    locale,
  };
}

export async function sendSchoolRegistrationConfirmationEmail(
  input: SchoolRegistrationConfirmationInput,
): Promise<void> {
  const { subject, text, html, locale } =
    await schoolRegistrationConfirmationTemplate(input);

  await sendMail({
    to: input.to,
    subject,
    text,
    html,
    locale,
  });
}
