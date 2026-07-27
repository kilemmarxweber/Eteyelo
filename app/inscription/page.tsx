import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  path: "/inscription",
  title: "Inscription élève",
  description:
    "Inscrivez un élève en ligne dans un établissement partenaire KlamboCore.",
});

export { default } from "../components/inscription-eleve/page";
