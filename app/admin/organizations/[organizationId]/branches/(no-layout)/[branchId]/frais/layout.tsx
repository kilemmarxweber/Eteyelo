import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import FraisSectionLayout from "./frais-section-layout";

export default async function FraisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("fee_catalog");
  return <FraisSectionLayout>{children}</FraisSectionLayout>;
}
