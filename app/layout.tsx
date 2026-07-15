import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Suspense, type ReactNode } from "react";
import "./globals.css";
import { AppLoadingProvider } from "@/components/app-loading-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Klambocore Sarl",
  description: "Application de gestion scolaire par Klambocore Sarl.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh font-sans antialiased">
        <Suspense fallback={null}>
          <AppLoadingProvider>{children}</AppLoadingProvider>
        </Suspense>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
