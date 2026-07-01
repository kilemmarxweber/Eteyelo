import Link from "next/link";
import { Plus, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { BranchCard } from "./branchCard";

type BranchesPageProps = {
  params: Promise<{ organizationId: string }>;
};

async function getOrganizationBranches(organizationId: string) {
  const branches = await prisma.branch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      branchemembers: {
        select: {
          _count: {
            select: { student: true },
          },
        },
      },
    },
  });

  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    studentsCount: branch.branchemembers.reduce(
      (total, member) => total + member._count.student,
      0,
    ),
  }));
}

export default async function BranchesPage({ params }: BranchesPageProps) {
  const { organizationId } = await params;
  const branches = await getOrganizationBranches(organizationId);

  const base = `/admin/organizations/${organizationId}/branches`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Établissements</h1>

          <p className="text-sm text-muted-foreground">
            Gérez les établissements de cette organisation.
          </p>
        </div>

        <Button asChild>
          <Link href={`${base}/new`}>
            <Plus className="size-4" />
            Créer un établissement
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {branches.map((branch) => (
          <BranchCard
            key={branch.id}
            branchId={branch.id}
            href={`${base}/${branch.id}`}
          >
            <Button
              variant="outline"
              className="h-auto min-h-24 w-full justify-start p-4"
            >
              <div className="flex min-w-0 flex-col gap-2 text-left">
                <School className="size-7 shrink-0 text-primary" aria-hidden />

                <span className="text-base font-semibold leading-snug">
                  {branch.name}
                </span>

                <span className="text-sm text-muted-foreground">
                  {branch.studentsCount} élève
                  {branch.studentsCount > 1 ? "s" : ""}
                </span>
              </div>
            </Button>
          </BranchCard>
        ))}
      </div>

      {!branches.length && (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Aucun établissement trouvé pour cette organisation.
        </p>
      )}

      <Button variant="ghost" asChild>
        <Link href={`/admin/organizations/${organizationId}`}>
          ← Retour à l’organisation
        </Link>
      </Button>
    </div>
  );
}
