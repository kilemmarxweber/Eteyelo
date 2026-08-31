import { getRequestConfig } from "next-intl/server";

import { loadMessages } from "@/lib/i18n";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";
import {
  intlLocaleFromUserLocale,
  normalizeUserLocale,
} from "@/lib/user-locale";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = normalizeUserLocale(
    (await requestLocale) ?? (await resolvePreferredLocale()),
  );

  return {
    locale: intlLocaleFromUserLocale(locale),
    messages: await loadMessages(locale),
    timeZone: "Africa/Kinshasa",
  };
});
