import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  path: "/galerie",
  title: "Galerie",
  description:
    "Galerie photo des établissements et événements scolaires sur KlamboCore.",
});

export { default } from "@/app/components/galerie/page";
