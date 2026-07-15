import { notFound } from "next/navigation";
import { ORG_ROLE } from "@/lib/permissions";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconClipboardList } from "@tabler/icons-react";
import FichecentralTable from "./components/FichecentralTable";

export default async function FicheCentralesPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  const { session } = await requireBranchContext();
  const canManage = canManageOrganization(session);
  const isTitulaire = Boolean(session?.teacherContext?.isTitulaire);

  const canAccess =
    canManage ||
    isTitulaire ||
    hasSessionRole(session, [
      ORG_ROLE.PARENT,
      "PARENT",
      ORG_ROLE.STUDENT,
      "STUDENT",
    ]);

  if (!canAccess) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Fiches centrales"
        description="Validez les interventions et alimentez les fiches de cotation globales"
        badge={
          <Badge
            variant="outline-primary"
            icon={<IconClipboardList size={14} />}
          >
            Validation
          </Badge>
        }
      />

      <Card
        variant="elevated"
        padding="none"
        className="animate-fade-in overflow-hidden rounded-lg border"
      >
        <CardHeader className="space-y-0 border-b bg-muted/20 px-4 py-3 lg:px-5">
          <CardTitle className="text-base">
            Fiches en attente de validation
          </CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Interventions groupées par cours, classe et période
          </p>
        </CardHeader>
        <CardContent className="px-4 py-3 lg:px-5 lg:py-4">
          <FichecentralTable
            organizationId={organizationId}
            branchId={branchId}
          />
        </CardContent>
      </Card>
    </>
  );
}
