import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  path: "/evenements",
  title: "Événements",
  description:
    "Agenda des événements scolaires publiés sur KlamboCore — cérémonies, activités et actualités des établissements.",
});

export { default } from "@/app/components/evenements/page";
