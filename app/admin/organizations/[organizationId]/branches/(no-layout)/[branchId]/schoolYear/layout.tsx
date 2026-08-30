import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

/** Année scolaire : privilege dédié `schoolYear:read`. */
export default async function SchoolYearLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("school_year");
  return children;
}
