import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = publicPageMetadata({
  path: "/terms",
  title: "Conditions d’utilisation",
  description:
    "Conditions générales d’utilisation de la plateforme KlamboCore.",
});

export { default } from "@/app/components/terms/page";
