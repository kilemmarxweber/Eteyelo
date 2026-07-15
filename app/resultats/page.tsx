import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  GraduationCap,
  School,
  Search,
  Trophy,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";
import { prisma } from "@/lib/prisma";
import { getPublicStudentResults } from "@/lib/public-results";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    branchId?: string;
    classeId?: string;
    yearId?: string;
    periodId?: string;
    q?: string;
  }>;
};

export default async function ResultatsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      ville: true,
      pays: true,
      typebranch: true,
    },
  });

  const selectedBranchId = params.branchId || branches[0]?.id || "";

  const [classes, years, periods] = selectedBranchId
    ? await Promise.all([
        prisma.classe.findMany({
          where: {
            branchId: selectedBranchId,
          },
          orderBy: {
            nameClasse: "asc",
          },
          select: {
            id: true,
            nameClasse: true,
          },
        }),

        prisma.schoolYear.findMany({
          where: {
            branchId: selectedBranchId,
          },
          orderBy: {
            startYear: "desc",
          },
          select: {
            id: true,
            nameYear: true,
            isCurrentYear: true,
          },
        }),

        prisma.period.findMany({
          where: {
            branchId: selectedBranchId,
          },
          orderBy: {
            startDate: "asc",
          },
          select: {
            id: true,
            label: true,
          },
        }),
      ])
    : [[], [], []];

  const selectedYearId =
    params.yearId || years.find((year) => year.isCurrentYear)?.id || "";

  const selectedPeriodId = params.periodId
    ? Number(params.periodId)
    : undefined;

  const results = selectedBranchId
    ? await getPublicStudentResults({
        branchId: selectedBranchId,
        classeId: params.classeId || undefined,
        yearId: selectedYearId || undefined,
        periodId: selectedPeriodId,
        q: params.q || undefined,
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <HomeNavbar />

      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 py-16 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <Badge className="bg-white/20 text-white">
            <Trophy className="mr-1 h-3 w-3" />
            Résultats scolaires
          </Badge>

          <h1 className="mt-4 max-w-7xl text-4xl font-black md:text-6xl">
            Consultez les résultats des élèves
          </h1>

          <p className="mt-5 max-w-7xl text-blue-50">
            Choisissez une école, une classe, une année scolaire, une période ou
            recherchez directement un élève par nom, prénom ou postnom.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <form className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-5">
            <label className="space-y-2 text-sm font-semibold text-blue-950">
              École
              <select
                name="branchId"
                defaultValue={selectedBranchId}
                className="h-12 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 outline-none"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.typebranch === "PRIMAIRE"
                      ? " (Primaire)"
                      : " (Secondaire)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-blue-950">
              Classe
              <select
                name="classeId"
                defaultValue={params.classeId || ""}
                className="h-12 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 outline-none"
              >
                <option value="">Toutes les classes</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nameClasse}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-blue-950">
              Année scolaire
              <select
                name="yearId"
                defaultValue={selectedYearId}
                className="h-12 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 outline-none"
              >
                <option value="">Toutes les années</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.nameYear}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-blue-950">
              Période
              <select
                name="periodId"
                defaultValue={params.periodId || ""}
                className="h-12 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 outline-none"
              >
                <option value="">Toutes les périodes</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-blue-950">
              Recherche élève
              <div className="relative">
                <Search className="absolute left-3 top-4 h-4 w-4 text-blue-700" />
                <input
                  name="q"
                  defaultValue={params.q || ""}
                  placeholder="Nom, prénom..."
                  className="h-12 w-full rounded-2xl border border-blue-100 bg-blue-50/40 pl-10 pr-4 outline-none"
                />
              </div>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button
              asChild
              variant="outline"
              className="rounded-full border-blue-100 text-blue-700"
            >
              <Link href="/resultats">Réinitialiser</Link>
            </Button>

            <Button className="rounded-full bg-blue-950 px-6 text-white hover:bg-blue-900">
              Afficher les résultats
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <StatCard
            icon={School}
            label="Écoles disponibles"
            value={branches.length}
          />

          <StatCard
            icon={GraduationCap}
            label="Classes"
            value={classes.length}
          />

          <StatCard
            icon={CalendarDays}
            label="Périodes"
            value={periods.length}
          />

          <StatCard
            icon={BarChart3}
            label="Résultats trouvés"
            value={results.length}
          />
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
          <div className="border-b border-blue-100 p-5">
            <h2 className="text-xl font-black text-blue-950">
              Résultats des élèves
            </h2>

            <p className="text-sm text-slate-500">
              Classement selon la moyenne des points enregistrés.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-blue-50 text-xs uppercase text-blue-950">
                <tr>
                  <th className="px-5 py-4">Rang</th>
                  <th className="px-5 py-4">Élève</th>
                  <th className="px-5 py-4">Sexe</th>
                  <th className="px-5 py-4">Classe</th>
                  <th className="px-5 py-4">Année</th>
                  <th className="px-5 py-4">Périodes</th>
                  <th className="px-5 py-4">Moyenne</th>
                </tr>
              </thead>

              <tbody>
                {results.map((result, index) => (
                  <tr
                    key={result.studentId}
                    className="border-t border-slate-100 transition hover:bg-blue-50/50"
                  >
                    <td className="px-5 py-4 font-black text-blue-950">
                      #{index + 1}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <UserRound className="h-5 w-5" />
                        </span>

                        <span className="font-bold text-blue-950">
                          {result.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">{result.sexe}</td>

                    <td className="px-5 py-4">{result.classe}</td>

                    <td className="px-5 py-4">{result.year}</td>

                    <td className="px-5 py-4">
                      {Array.from(new Set(result.periods)).join(", ")}
                    </td>

                    <td className="px-5 py-4">
                      <Badge className="bg-cyan-100 text-cyan-700">
                        {result.average.toFixed(2)}%
                      </Badge>
                    </td>
                  </tr>
                ))}

                {!results.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      Aucun résultat trouvé pour cette sélection.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-blue-950">{value}</p>
        </div>

        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </div>
  );
}
