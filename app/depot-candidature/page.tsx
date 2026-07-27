import type { Metadata } from "next";

import { getActiveBranchesForJobApplication } from "../components/depot-candidature/job-application.actions";
import { JobApplicationForm } from "../components/depot-candidature/job-application-form";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  path: "/depot-candidature",
  title: "Dépôt de candidature",
  description:
    "Postulez auprès des établissements partenaires KlamboCore — dépôt de candidature en ligne.",
});

export default async function DepotCandidaturePage() {
  const branches = await getActiveBranchesForJobApplication();

  return <JobApplicationForm branches={branches} />;
}
