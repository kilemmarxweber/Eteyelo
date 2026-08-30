import { Layout, LayoutBody } from "@/components/custom/layout";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function FicheCentralesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("fiche_centrale");
  return (
    <Layout>
      <LayoutBody className="space-y-6">{children}</LayoutBody>
    </Layout>
  );
}
