import Link from "next/link";
import {
  ArrowRight,
  Plus,
  School,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { BRANCH_TYPES } from "@/lib/academic-structure";
import {
  getAnyUserBranchMemberships,
  isGestionnaireBranchLandingRole,
} from "@/lib/auth/user-branch-access";
import { prisma } from "@/lib/prisma";
import { BranchCard } from "./branchCard";
import { BranchTypeBadge } from "@/components/branch/branch-type-badge";

export const dynamic = "force-dynamic";

type BranchesPageProps = {
  params: Promise<{ organizationId: string }>;
};

async function getOrganizationBranches(organizationId: string) {
  const branches = await prisma.branch.findMany({
    where: { organizationId },
    orderBy: [{ typebranch: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      typebranch: true,
      cycles: {
        where: { isActive: true },
        select: { cycle: true, isActive: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
      isActive: true,
      branchemembers: {
        select: {
          _count: {
            select: { student: true },
          },
        },
      },
    },
  });

  const typeOrder = Object.fromEntries(
    BRANCH_TYPES.map((type, index) => [type, index]),
  ) as Record<string, number>;

  return branches
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      description: branch.description,
      typebranch: branch.typebranch,
      cycles: branch.cycles,
      isActive: branch.isActive,
      studentsCount: branch.branchemembers.reduce(
        (total, member) => total + member._count.student,
        0,
      ),
    }))
    .sort((left, right) => {
      const leftOrder = typeOrder[left.typebranch] ?? 99;
      const rightOrder = typeOrder[right.typebranch] ?? 99;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name, "fr", {
        sensitivity: "base",
      });
    });
}

export default async function BranchesPage({ params }: BranchesPageProps) {
  const { organizationId } = await params;
  const context = await enforceOrganizationManagerPage(organizationId);
  let branches = await getOrganizationBranches(organizationId);

  const isGestionnaire = isGestionnaireBranchLandingRole(
    context.membership?.role,
  );
  const assigned = isGestionnaire
    ? await getAnyUserBranchMemberships(context.userId, organizationId)
    : [];

  const base = `/admin/organizations/${organizationId}/branches`;

  if (isGestionnaire && assigned.length === 1) {
    redirect(`${base}/${assigned[0].branchId}`);
  }

  const isScoped = isGestionnaire && assigned.length > 0;

  if (isScoped) {
    const assignedIds = new Set(assigned.map((row) => row.branchId));
    branches = branches.filter((branch) => assignedIds.has(branch.id));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {isGestionnaire ? null : (
        <BackLink
          href={`/admin/organizations/${organizationId}`}
          label="Retour organisation"
        />
      )}

      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground/90">
              <School className="size-3.5" />
              Établissements
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Gérez les établissements
            </h1>

            <p className="mt-2 text-sm leading-6 text-primary-foreground/90">
              {isScoped
                ? "Consultez et administrez les établissements qui vous sont attribués."
                : "Consultez, créez et administrez les établissements, campus ou antennes liés à cette organisation."}
            </p>
          </div>

          {isScoped ? null : (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-card text-foreground hover:bg-muted"
              asChild
            >
              <Link href={`${base}/new`}>
                <Plus className="mr-1.5 size-3.5" />
                Créer un établissement
              </Link>
            </Button>
          )}
        </div>
      </section>

      {branches.length > 0 ? (
        <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm">
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branchId={branch.id}
              branchName={branch.name}
              enterHref={`${base}/${branch.id}`}
              editHref={`${base}/edit?branchId=${branch.id}`}
              isActive={branch.isActive}
            >
              <div className="group flex h-full min-w-0 items-start gap-2.5 overflow-hidden rounded-xl border border-border/80 bg-card py-2.5 pl-3 pr-28 transition hover:border-primary/30 hover:bg-muted/40 hover:shadow-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <School className="size-3.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {branch.name}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </span>
                  {branch.description ? (
                    <span className="mt-0.5 block truncate text-xs leading-snug text-muted-foreground">
                      {branch.description}
                    </span>
                  ) : null}

                  <span className="mt-1 flex min-w-0 flex-col gap-1">
                    <BranchTypeBadge
                      typebranch={branch.typebranch}
                      cycles={branch.cycles}
                      className="h-5 px-1.5 text-[10px]"
                    />
                    <span className="flex flex-nowrap items-center gap-1.5">
                      <span className="truncate text-[11px] text-muted-foreground">
                        {branch.studentsCount} élève
                        {branch.studentsCount > 1 ? "s" : ""}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${branch.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                      >
                        {branch.isActive ? "Actif" : "Archive"}
                      </span>
                    </span>
                  </span>
                </span>
              </div>
            </BranchCard>
          ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Aucun établissement trouvé pour cette organisation.
        </section>
      )}
    </div>
  );
}
