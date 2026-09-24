import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import { isAtelierBranchType } from "@/lib/atelier-student-access";

import Cours from "./components/coursClient";

export default async function Page() {
  const { session, typebranch } = await requireBranchContext();
  await assertBranchAreaAccess("courses", session);

  return (
    <Cours
      isPrimary={typebranch === "PRIMAIRE"}
      isAtelier={isAtelierBranchType(typebranch)}
      supportsCourseImport={isUniversiteBranch(typebranch)}
    />
  );
}
