import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = publicPageMetadata({
  path: "/inscription-ecole",
  title: "Inscrire mon école",
  description:
    "Demandez l’intégration de votre établissement scolaire sur la plateforme KlamboCore.",
});

export { default } from "../components/inscription-ecole/page";
