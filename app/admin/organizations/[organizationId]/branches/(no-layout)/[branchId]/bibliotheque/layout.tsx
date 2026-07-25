import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function BibliothequeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("library");
  return children;
}
