import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Auth — noindex (sign-in / sign-up ne doivent pas polluer la SERP). */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
