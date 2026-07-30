import { notFound } from "next/navigation";

import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { isSchoolBranch } from "@/lib/branch-capabilities";

export default async function DevoirsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("devoirs");
  const { typebranch } = await requireBranchContext({ onMissing: "redirect" });
  if (!isSchoolBranch(typebranch)) {
    notFound();
  }
  return children;
}
