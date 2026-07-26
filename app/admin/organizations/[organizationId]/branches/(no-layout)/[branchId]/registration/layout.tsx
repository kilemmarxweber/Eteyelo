import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("registration");
  return children;
}
