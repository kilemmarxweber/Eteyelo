import { headers } from "next/headers";
import { createTranslator } from "next-intl";

import { auth } from "@/lib/auth";
import { loadMessages, type I18nNamespace } from "@/lib/i18n";
import { intlLocaleFromUserLocale } from "@/lib/user-locale";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";

export async function getServerTranslator(namespace: I18nNamespace) {
  const session = await auth.api.getSession({ headers: await headers() });
  const locale = await resolvePreferredLocale(
    (session?.user as { locale?: string | null } | undefined)?.locale,
  );
  const messages = await loadMessages(locale);
  return createTranslator({
    locale: intlLocaleFromUserLocale(locale),
    messages,
    namespace,
  });
}
