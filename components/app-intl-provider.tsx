"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import {
  intlLocaleFromUserLocale,
  type UserLocale,
} from "@/lib/user-locale";

type Props = {
  locale: UserLocale;
  messages: Record<string, unknown>;
  children: ReactNode;
};

export function AppIntlProvider({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider
      locale={intlLocaleFromUserLocale(locale)}
      messages={messages}
      timeZone="Africa/Kinshasa"
    >
      {children}
    </NextIntlClientProvider>
  );
}
