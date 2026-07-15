import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  School,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-blue-950 p-6 text-white shadow-2xl shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <School className="size-4" />
              Établissements
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Gérez les établissements
            </h1>

            <p className="mt-3 text-sm leading-7 text-blue-50 sm:text-base">
              Consultez, créez et administrez les établissements, campus ou
              antennes liés à cette organisation.
            </p>
          </div>

          <Button
            variant="secondary"
            className="h-11 rounded-full bg-white text-blue-950 hover:bg-blue-50"
            asChild
          >
            <Link href={`${base}/new`}>
              <Plus className="mr-2 size-4" />
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
              <div className="group flex min-h-44 flex-col justify-between rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-950/25 hover:shadow-xl hover:shadow-blue-950/10">
                <span className="flex items-start justify-between gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-white">
                    <School className="size-5" />
                  </span>

                  <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-950" />
                </span>

                <span className="mt-6">
                  <span className="block text-lg font-bold text-slate-950">
                    {branch.name}
                  </span>

                  <span className="mt-2 block text-sm leading-6 text-slate-600">
                    Type:{" "}
                    {branch.typebranch === "PRIMAIRE"
                      ? "Primaire"
                      : "Secondaire"}
                  </span>

                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    {branch.studentsCount} élève
                    {branch.studentsCount > 1 ? "s" : ""} inscrit
                    {branch.studentsCount > 1 ? "s" : ""}
                  </span>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {branch.isActive ? "Actif" : "Archive"}
                  </span>
                </span>
              </div>
            </BranchCard>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed bg-white p-6 text-sm text-slate-600 shadow-sm">
          Aucun établissement trouvé pour cette organisation.
        </section>
      )}

      <Button variant="ghost" asChild className="w-fit rounded-full">
        <Link href={`/admin/organizations/${organizationId}`}>
          <ArrowLeft className="mr-2 size-4" />
          Retour organisation
        </Link>
      </Button>
    </div>
  );
}
