import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { IconUserCheck } from "@tabler/icons-react";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { requiresStudentImport } from "@/lib/branch-capabilities";
import { getServerTranslator } from "@/lib/i18n-server";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const query = await searchParams;
  const { organizationId, branchId, typebranch } = await requireBranchContext();

  if (requiresStudentImport(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/student`,
    );
  }

  const t = await getServerTranslator("registration");

  return (
    <BranchPageShell
      className="w-full"
      title={t("title")}
      description={t("description")}
      badge={
        <Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>
          {t("badge")}
        </Badge>
      }
    >
      <RegistrationForm initialRequestId={query.requestId ?? ""} />
    </BranchPageShell>
  );
}
