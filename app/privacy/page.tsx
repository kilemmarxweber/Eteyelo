import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = publicPageMetadata({
  path: "/privacy",
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité et protection des données personnelles sur KlamboCore.",
});

export { default } from "@/app/components/privacy/page";
