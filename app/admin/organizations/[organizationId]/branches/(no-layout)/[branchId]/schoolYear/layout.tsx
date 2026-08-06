import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

/** Année scolaire : school_ops (propriétaire inclus) plutôt que school_admin seul. */
export default async function SchoolYearLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("school_ops_settings");
  return children;
}
