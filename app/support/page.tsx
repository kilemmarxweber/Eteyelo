import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  path: "/support",
  title: "Support",
  description:
    "Assistance et support KlamboCore pour établissements, parents et équipes administratives.",
});

export { default } from "../components/support/page";
