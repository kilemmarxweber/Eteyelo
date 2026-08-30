import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import TeachingSectionLayout from "./teaching-section-layout";

export default async function TeachingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("teaching");
  return <TeachingSectionLayout>{children}</TeachingSectionLayout>;
}
