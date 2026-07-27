import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = publicPageMetadata({
  path: "/produits-digitaux",
  title: "Produits digitaux",
  description:
    "Solutions et produits numériques KlamboCore pour la gestion et le marketing scolaire.",
});

export { default } from "@/app/components/produits-digitaux/page";
