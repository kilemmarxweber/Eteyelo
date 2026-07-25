import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("notes");
  return children;
}
