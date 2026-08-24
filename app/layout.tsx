import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { ReactNode } from "react";
import "./globals.css";
import { AppIntlProvider } from "@/components/app-intl-provider";
import { AppLoadingProvider } from "@/components/app-loading-provider";
import { Toaster } from "@/components/ui/sonner";
import { loadMessages } from "@/lib/i18n";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";
import { intlLocaleFromUserLocale } from "@/lib/user-locale";
import {
  SITE_DESCRIPTION,
  SITE_LEGAL_NAME,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_URL,
} from "@/lib/seo/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_LEGAL_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_LEGAL_NAME, url: SITE_URL }],
  creator: SITE_LEGAL_NAME,
  publisher: SITE_LEGAL_NAME,
  keywords: [
    "KlamboCore",
    "gestion scolaire",
    "écoles RDC",
    "inscriptions",
    "résultats scolaires",
    "Kinshasa",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_CD",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_LEGAL_NAME}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SITE_OG_IMAGE,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_LEGAL_NAME}`,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const locale = await resolvePreferredLocale();
  const messages = await loadMessages(locale);

  return (
    <html
      lang={intlLocaleFromUserLocale(locale)}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh font-sans antialiased">
        <AppIntlProvider locale={locale} messages={messages}>
          <AppLoadingProvider>{children}</AppLoadingProvider>
          <Toaster richColors closeButton />
        </AppIntlProvider>
      </body>
    </html>
  );
}
