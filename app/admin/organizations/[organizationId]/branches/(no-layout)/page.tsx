import Link from "next/link";
import {
  ArrowRight,
  Plus,
  School,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
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
      typebranch: true,
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

  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    typebranch: branch.typebranch,
    isActive: branch.isActive,
    studentsCount: branch.branchemembers.reduce(
      (total, member) => total + member._count.student,
      0,
    ),
  }));
}

export default async function BranchesPage({ params }: BranchesPageProps) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);
  const branches = await getOrganizationBranches(organizationId);

  const base = `/admin/organizations/${organizationId}/branches`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <section className="rounded-2xl bg-blue-950 p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-50">
              <School className="size-3.5" />
              Établissements
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Gérez les établissements
            </h1>

            <p className="mt-2 text-sm leading-6 text-blue-50">
              Consultez, créez et administrez les établissements, campus ou
              antennes liés à cette organisation.
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="rounded-full bg-white text-blue-950 hover:bg-blue-50"
            asChild
          >
            <Link href={`${base}/new`}>
              <Plus className="mr-1.5 size-3.5" />
              Créer un établissement
            </Link>
          </Button>
        </div>
      </section>

      {branches.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branchId={branch.id}
              enterHref={`${base}/enter/${branch.id}`}
              editHref={`${base}/edit?branchId=${branch.id}`}
              isActive={branch.isActive}
            >
              <div className="group flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-950/25 hover:shadow-md">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-950 text-white">
                    <School className="size-4" />
                  </span>

                  <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-950" />
                </span>

                <span>
                  <span className="block text-base font-semibold text-slate-950">
                    {branch.name}
                  </span>

                  <span className="mt-1 block text-sm leading-5 text-slate-600">
                    Type:{" "}
                    {branch.typebranch === "PRIMAIRE"
                      ? "Primaire"
                      : "Secondaire"}
                  </span>

                  <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                    {branch.studentsCount} élève
                    {branch.studentsCount > 1 ? "s" : ""} inscrit
                    {branch.studentsCount > 1 ? "s" : ""}
                  </span>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {branch.isActive ? "Actif" : "Archive"}
                  </span>
                </span>
              </div>
            </BranchCard>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed bg-white p-5 text-sm text-slate-600 shadow-sm">
          Aucun établissement trouvé pour cette organisation.
        </section>
      )}
    </div>
  );
}
