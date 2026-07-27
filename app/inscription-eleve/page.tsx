import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  path: "/inscription-eleve",
  title: "Inscription élève",
  description: "Redirection vers la page d’inscription élève KlamboCore.",
  index: false,
});

export default function LegacyInscriptionElevePage() {
  redirect("/inscription");
}
