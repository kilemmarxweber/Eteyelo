import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = publicPageMetadata({
  path: "/about",
  title: "À propos",
  description:
    "Découvrez KlamboCore Sarl — plateforme de gestion scolaire et services numériques pour établissements en RDC.",
});

export { default } from "@/app/components/about/page";
