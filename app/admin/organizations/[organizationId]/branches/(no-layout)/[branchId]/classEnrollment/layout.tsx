import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import ClassEnrollmentSectionLayout from "./class-enrollment-section-layout";

export default async function ClassEnrollmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("registration");
  return (
    <ClassEnrollmentSectionLayout>{children}</ClassEnrollmentSectionLayout>
  );
}
