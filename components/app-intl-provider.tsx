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
      onError={(error) => {
        if (error.code === "MISSING_MESSAGE") return;
        console.error(error);
      }}
      getMessageFallback={({ key }) => key.split(".").pop() ?? key}
    >
      {children}
    </NextIntlClientProvider>
  );
}
