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
    <main className="min-h-screen bg-background text-foreground">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <Trophy className="size-3.5" />
            Resultats scolaires
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
            Consultez les resultats des eleves
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-primary-foreground/90 md:text-base">
            Choisissez une ecole, une classe, une annee scolaire, une periode ou
            recherchez directement un eleve par nom, prenom ou postnom.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <form className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-5">
            <label className="space-y-2 text-sm font-semibold text-foreground">
              Ecole
              <select
                name="branchId"
                defaultValue={selectedBranchId}
                className="h-12 w-full rounded-2xl border border-border bg-muted/40 px-4 outline-none focus:border-primary/40"
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

            <label className="space-y-2 text-sm font-semibold text-foreground">
              Classe
              <select
                name="classeId"
                defaultValue={params.classeId || ""}
                className="h-12 w-full rounded-2xl border border-border bg-muted/40 px-4 outline-none focus:border-primary/40"
              >
                <option value="">Toutes les classes</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nameClasse}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-foreground">
              Annee scolaire
              <select
                name="yearId"
                defaultValue={selectedYearId}
                className="h-12 w-full rounded-2xl border border-border bg-muted/40 px-4 outline-none focus:border-primary/40"
              >
                <option value="">Toutes les annees</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.nameYear}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-foreground">
              Periode
              <select
                name="periodId"
                defaultValue={params.periodId || ""}
                className="h-12 w-full rounded-2xl border border-border bg-muted/40 px-4 outline-none focus:border-primary/40"
              >
                <option value="">Toutes les periodes</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-foreground">
              Recherche eleve
              <div className="relative">
                <Search className="absolute left-3 top-4 size-4 text-primary" />
                <input
                  name="q"
                  defaultValue={params.q || ""}
                  placeholder="Nom, prenom..."
                  className="h-12 w-full rounded-2xl border border-border bg-muted/40 pl-10 pr-4 outline-none focus:border-primary/40"
                />
              </div>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/resultats">Reinitialiser</Link>
            </Button>

            <Button className="rounded-full px-6">
              Afficher les resultats
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </form>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <StatCard
            icon={School}
            label="Ecoles disponibles"
            value={branches.length}
          />

          <StatCard
            icon={GraduationCap}
            label="Classes"
            value={classes.length}
          />

          <StatCard
            icon={CalendarDays}
            label="Periodes"
            value={periods.length}
          />

          <StatCard
            icon={BarChart3}
            label="Resultats trouves"
            value={results.length}
          />
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Classement
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              Resultats des eleves
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Classement selon la moyenne des points enregistres.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-primary/5 text-xs uppercase text-foreground">
                <tr>
                  <th className="px-5 py-4">Rang</th>
                  <th className="px-5 py-4">Eleve</th>
                  <th className="px-5 py-4">Sexe</th>
                  <th className="px-5 py-4">Classe</th>
                  <th className="px-5 py-4">Annee</th>
                  <th className="px-5 py-4">Periodes</th>
                  <th className="px-5 py-4">Moyenne</th>
                </tr>
              </thead>

              <tbody>
                {results.map((result, index) => (
                  <tr
                    key={result.studentId}
                    className="border-t border-border transition hover:bg-primary/5"
                  >
                    <td className="px-5 py-4 font-bold text-primary">
                      #{index + 1}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserRound className="size-5" />
                        </span>
                        <span className="font-semibold text-foreground">
                          {result.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {result.sexe}
                    </td>
                    <td className="px-5 py-4">{result.classe}</td>
                    <td className="px-5 py-4">{result.year}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {Array.from(new Set(result.periods)).join(", ")}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        {result.average.toFixed(2)}%
                      </Badge>
                    </td>
                  </tr>
                ))}

                {!results.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-muted-foreground"
                    >
                      Aucun resultat trouve pour cette selection.
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
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
        </div>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
      </div>
    </div>
  );
}
