import { getActiveBranches } from "./insption.actions";
import { StudentRegistrationForm } from "./student-registration-form";
export const dynamic = "force-dynamic";
export default async function InscriptionElevePage() {
  const branches = await getActiveBranches();

  return <StudentRegistrationForm branches={branches} />;
}
