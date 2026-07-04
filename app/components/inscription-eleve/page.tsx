import { getActiveBranches } from "./insption.actions";
import { StudentRegistrationForm } from "./student-registration-form";

export default async function InscriptionElevePage() {
  const branches = await getActiveBranches();

  return <StudentRegistrationForm branches={branches} />;
}
