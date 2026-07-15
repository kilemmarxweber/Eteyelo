import { getActiveBranchesForJobApplication } from "../components/depot-candidature/job-application.actions";
import { JobApplicationForm } from "../components/depot-candidature/job-application-form";
export const dynamic = "force-dynamic";
export default async function DepotCandidaturePage() {
  const branches = await getActiveBranchesForJobApplication();

  return <JobApplicationForm branches={branches} />;
}
