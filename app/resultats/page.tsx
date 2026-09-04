import { Trophy, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";
import {
  getAcademicPeriodOrder,
  normalizeAcademicPeriodLabel,
} from "@/lib/academic-structure";
import {
  CYCLE_SORT_ORDER,
  cycleLabel,
  getBranchCycles,
  isCycle,
  resolveCycle,
} from "@/lib/cycle";
import { prisma } from "@/lib/prisma";
import { getPublicStudentResults } from "@/lib/public-results";

import { ResultatsFilters } from "./resultats-filters";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    classe?: string;
    classeId?: string;
    year?: string;
    yearId?: string;
    period?: string;
    periodId?: string;
    cycle?: string;
    q?: string;
  }>;
};

function toList(value?: string | string[]): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueInOrder<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export default async function ResultatsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedBranchIds = toList(params.branchId);
  const selectedCycles = toList(params.cycle).filter(isCycle);
  const selectedClasses = toList(params.classe);
  const selectedPeriods = toList(params.period).map((item) =>
    normalizeAcademicPeriodLabel(item),
  );

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
      cycles: {
        where: { isActive: true },
        select: {
          cycle: true,
          sortOrder: true,
          isActive: true,
        },
      },
    },
  });

  const branchOptions = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    cycles: getBranchCycles(branch),
  }));

  const cycleOptions = uniqueInOrder(
    branchOptions
      .flatMap((branch) => branch.cycles)
      .sort((left, right) => CYCLE_SORT_ORDER[left] - CYCLE_SORT_ORDER[right]),
    (cycle) => cycle,
  ).map((cycle) => ({
    value: cycle,
    label: cycleLabel(cycle),
  }));

  const branchIds = branches.map((branch) => branch.id);

  const [classes, years, periods] = branchIds.length
    ? await Promise.all([
        prisma.classe.findMany({
          where: { branchId: { in: branchIds } },
          orderBy: { nameClasse: "asc" },
          select: {
            nameClasse: true,
            branchId: true,
            cycle: true,
            branch: {
              select: { typebranch: true },
            },
          },
        }),
        prisma.schoolYear.findMany({
          where: {
            branchId: { in: branchIds },
            isArchived: false,
          },
          orderBy: { startYear: "desc" },
          select: {
            nameYear: true,
            startYear: true,
            branchId: true,
          },
        }),
        prisma.period.findMany({
          where: { branchId: { in: branchIds } },
          orderBy: { startDate: "asc" },
          select: {
            label: true,
            branchId: true,
            cycle: true,
          },
        }),
      ])
    : [[], [], []];

  const classOptions = classes.map((classe) => ({
    name: classe.nameClasse,
    branchId: classe.branchId,
    cycle: resolveCycle(classe, classe.branch),
  }));

  const yearOptions = years.map((year) => ({
    name: year.nameYear,
    branchId: year.branchId,
  }));

  const periodOptions = uniqueInOrder(
    periods
      .map((period) => ({
        label: normalizeAcademicPeriodLabel(period.label),
        branchId: period.branchId,
        cycle: period.cycle,
      }))
      .sort(
        (left, right) =>
          getAcademicPeriodOrder(left.label, left.cycle) -
          getAcademicPeriodOrder(right.label, right.cycle),
      ),
    (period) => `${period.branchId}::${period.cycle}::${period.label}`,
  ).map(({ label, branchId, cycle }) => ({ label, branchId, cycle }));

  const scopedBranchIds = selectedBranchIds.filter((id) => {
    const branch = branchOptions.find((item) => item.id === id);
    if (!branch) return false;
    if (
      selectedCycles.length &&
      !selectedCycles.some((cycle) => branch.cycles.includes(cycle))
    ) {
      return false;
    }
    return true;
  });
  const inScope = (branchId: string) =>
    scopedBranchIds.length === 0 || scopedBranchIds.includes(branchId);

  const uniqueYears = uniqueInOrder(
    yearOptions.filter((item) => inScope(item.branchId)),
    (item) => item.name,
  );
  const requestedYear = params.year?.trim() || "";
  const selectedYear =
    requestedYear && uniqueYears.some((year) => year.name === requestedYear)
      ? requestedYear
      : uniqueYears[0]?.name || "";

  const results = await getPublicStudentResults({
    branchIds: scopedBranchIds,
    cycles: selectedCycles,
    classeNames: selectedClasses,
    classeId: params.classeId || undefined,
    yearName: selectedYear || undefined,
    yearId: params.yearId || undefined,
    periodLabels: selectedPeriods,
    periodId:
      params.periodId && Number.isFinite(Number(params.periodId))
        ? Number(params.periodId)
        : undefined,
    q: params.q || undefined,
  });

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
            Choisissez un ou plusieurs cycles, ecoles, classes, une annee
            scolaire, une ou plusieurs periodes ou recherchez un eleve par nom,
            prenom ou postnom.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <ResultatsFilters
          cycles={cycleOptions}
          branches={branchOptions}
          classes={classOptions}
          years={yearOptions}
          periods={periodOptions}
          selectedCycles={selectedCycles}
          selectedBranchIds={scopedBranchIds}
          selectedClasses={selectedClasses}
          selectedYear={selectedYear}
          selectedPeriods={selectedPeriods}
          q={params.q || ""}
          resultsCount={results.length}
        />

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
              {selectedYear ? ` Annee : ${selectedYear}.` : ""}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-primary/5 text-xs uppercase text-foreground">
                <tr>
                  <th className="px-5 py-4">Rang</th>
                  <th className="px-5 py-4">Eleve</th>
                  <th className="px-5 py-4">Sexe</th>
                  <th className="px-5 py-4">Ecole</th>
                  <th className="px-5 py-4">Classe</th>
                  <th className="px-5 py-4">Annee</th>
                  <th className="px-5 py-4">Periodes</th>
                  <th className="px-5 py-4">Moyenne</th>
                </tr>
              </thead>

              <tbody>
                {results.map((result, index) => (
                  <tr
                    key={`${result.branchId}-${result.studentId}`}
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
                        <span className="font-semibold capitalize text-foreground">
                          {result.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {result.sexe}
                    </td>
                    <td className="px-5 py-4">{result.branchName}</td>
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
                      colSpan={8}
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
