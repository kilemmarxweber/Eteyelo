import { headers } from "next/headers";
import { createTranslator, type AbstractIntlMessages } from "next-intl";

import { auth } from "@/lib/auth";
import { loadMessages, type I18nNamespace } from "@/lib/i18n";
import { intlLocaleFromUserLocale } from "@/lib/user-locale";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";

type TranslateValues = Record<string, string | number | Date | boolean | null | undefined>;

export async function getServerTranslator(namespace: I18nNamespace) {
  const session = await auth.api.getSession({ headers: await headers() });
  const locale = await resolvePreferredLocale(
    (session?.user as { locale?: string | null } | undefined)?.locale,
  );
  const messages = await loadMessages(locale);
  const t = createTranslator({
    locale: intlLocaleFromUserLocale(locale),
    messages: messages as AbstractIntlMessages,
    namespace,
  });
  // Messages JSON are loaded dynamically — keep a practical callable signature for App Router pages.
  return ((key: string, values?: TranslateValues) =>
    t(key as never, values as never)) as (
    key: string,
    values?: TranslateValues,
  ) => string;
}
