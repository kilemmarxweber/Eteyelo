"use client";

import { useMemo, useState } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Banknote,
  BarChart3,
  Briefcase,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Loader2,
  Smile,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ReportAreaChart,
  ReportBarChart,
  ReportDonutChart,
  ReportFunnelChart,
  ReportRadialChart,
} from "@/components/reports/charts/report-charts";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import {
  ReportDataTable,
  ReportSection,
} from "@/components/reports/report-section";
import { formatReportAmount } from "@/lib/reports/format-amount";
import type { ReportTab } from "@/lib/reports/org/definitions";
import { exportRapportEffectifsPdf } from "./export-rapport-effectifs-pdf";
import { getRapportReportContextAction } from "./rapport.action";

type ReportPayload = Awaited<
  ReturnType<typeof import("./rapport.action").loadOrganizationReports>
>;

type Props = {
  organizationId: string;
  data: ReportPayload;
};

const TAB_ITEMS: Array<{ value: ReportTab; label: string }> = [
  { value: "overview", label: "Vue d'ensemble" },
  { value: "effectifs", label: "Effectifs" },
  { value: "presences", label: "Présences" },
  { value: "finance", label: "Finance" },
  { value: "satisfaction", label: "Satisfaction" },
  { value: "resultats", label: "Résultats" },
  { value: "rh", label: "RH / Candidatures" },
  { value: "inscriptions", label: "Inscriptions" },
];

function buildTabHref(
  organizationId: string,
  data: ReportPayload,
  tab: ReportTab,
) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("scope", data.meta.scope);
  params.set(
    "branchId",
    data.meta.scope === "all" ? "all" : (data.meta.selectedBranchId ?? "all"),
  );
  params.set("schoolYearKey", data.meta.schoolYearKey);
  return `/admin/organizations/${organizationId}/rapport?${params.toString()}`;
}

export function RapportDashboard({ organizationId, data }: Props) {
  const router = useRouter();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [presenceTrack, setPresenceTrack] = useState<
    "students" | "teachers" | "personnel"
  >("students");

  const { meta, tab } = data;
  const currency = meta.currency.baseCurrency;
  const money = (value: number) => formatReportAmount(value, currency);

  const genderConfig = useMemo(
    () => ({
      Garçons: { label: "Garçons", color: "hsl(221 83% 53%)" },
      Filles: { label: "Filles", color: "hsl(340 75% 55%)" },
      Hommes: { label: "Hommes", color: "hsl(221 83% 53%)" },
      Femmes: { label: "Femmes", color: "hsl(340 75% 55%)" },
    }),
    [],
  );

  function onTabChange(next: string) {
    router.push(buildTabHref(organizationId, data, next as ReportTab));
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    const overview = data.overview;
    const effectifs = data.effectifs;
    const finance = data.finance;
    const attendance = data.attendance;
    const satisfaction = data.satisfaction;
    const results = data.results;
    const hiring = data.hiring;
    const registrations = data.registrations;

    if (overview) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet([
          {
            Devise: currency,
            Taux: meta.currency.rateLabel ?? "",
            Élèves: overview.students,
            Parents: overview.parents,
            Enseignants: overview.teachers,
            Personnel: overview.personnel,
            "Taux présence %": overview.attendanceRate,
            Budget: money(overview.budget),
            Récolté: money(overview.recoltes),
            Reste: money(overview.reste),
            Satisfaction: overview.satisfaction,
            "Réussite %": overview.successRate,
            Embauches: overview.hired,
            Inscriptions: overview.registrations,
          },
        ]),
        "Vue ensemble",
      );
    }

    if (effectifs) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(effectifs.students.byClass),
        "Élèves par classe",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(effectifs.byBranch),
        "Effectifs branches",
      );
    }
    if (finance) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          finance.byMonth.map((m) => ({
            Mois: m.label,
            Récoltes: money(m.recoltes),
            Dépenses: money(m.depenses),
          })),
        ),
        "Finance mois",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          finance.byBranch.map((b) => ({
            Branche: b.branchName,
            Budget: money(b.budget),
            Récolté: money(b.recoltes),
            Reste: money(b.reste),
            Dépenses: money(b.depenses),
          })),
        ),
        "Finance branches",
      );
    }
    if (attendance) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(attendance.students.byStatus),
        "Présences élèves",
      );
    }
    if (satisfaction) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(satisfaction.byMonth),
        "Satisfaction",
      );
    }
    if (results) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(results.byClass),
        "Résultats classes",
      );
    }
    if (hiring) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(hiring.byStatus),
        "Candidatures",
      );
    }
    if (registrations) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(registrations.byStatus),
        "Inscriptions",
      );
    }

    XLSX.writeFile(workbook, "rapport-organisation.xlsx");
    toast.success("Export Excel généré.");
  }

  async function exportPdf() {
    if (!meta.selectedBranchId || meta.scope === "all") {
      toast.error("Sélectionnez une branche pour l'export PDF.");
      return;
    }
    if (!data.effectifs || !data.attendance || !data.finance) {
      toast.error("Données insuffisantes pour le PDF.");
      return;
    }

    setExportingPdf(true);
    try {
      const context = await getRapportReportContextAction({
        organizationId,
        branchId: meta.selectedBranchId,
      });
      await exportRapportEffectifsPdf(
        {
          summary: {
            totalStudents: data.effectifs.students.total,
            activeStudents: data.effectifs.students.active,
            inactiveStudents: data.effectifs.students.inactive,
            boys: data.effectifs.students.boys,
            girls: data.effectifs.students.girls,
            teachers: data.effectifs.teachers.total,
            parents: data.effectifs.parents.total,
            totalPayments: data.finance.recoltes,
            totalExpenses: data.finance.depenses,
            balance: data.finance.solde,
          },
          studentsByClass: data.effectifs.students.byClass.map((c) => ({
            name: c.name,
            total: c.total,
          })),
          genderStats: data.effectifs.students.byGender,
          statusStats: data.effectifs.students.byStatus,
          attendanceStats: data.attendance.students.byStatus.map((s) => ({
            name: s.name,
            value: s.value,
          })),
          financeByMonth: data.finance.byMonth.map((m) => ({
            month: m.label,
            paiements: m.recoltes,
            depenses: m.depenses,
          })),
          currency,
          rateLabel: meta.currency.rateLabel,
        },
        context,
      );
      toast.success("Le rapport PDF a été généré.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de générer le rapport PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  const presence =
    data.attendance?.[presenceTrack] ?? data.attendance?.students;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/10 sm:p-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground/90">
          <BarChart3 className="size-3.5" />
          Rapports & statistiques
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Hub analytique organisation
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-primary-foreground/90">
          Effectifs, présences, finance, satisfaction, résultats, RH et
          inscriptions — une branche ou toutes les branches.
        </p>
        <p className="mt-2 text-xs font-medium text-primary-foreground/80">
          Devise : {meta.currency.baseCurrency}
          {meta.currency.rateLabel ? ` · ${meta.currency.rateLabel}` : ""}
        </p>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <ReportFilters
          organizationId={organizationId}
          branches={meta.branches}
          schoolYears={meta.schoolYears}
          scope={meta.scope}
          selectedBranchId={meta.selectedBranchId}
          schoolYearKey={meta.schoolYearKey}
          tab={tab}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            type="button"
            onClick={exportPdf}
            disabled={exportingPdf || meta.scope === "all"}
            variant="outline"
            className="rounded-full"
          >
            {exportingPdf ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <FileText className="mr-1.5 size-3.5" />
            )}
            {exportingPdf ? "Export…" : "Export PDF"}
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={exportExcel}
            variant="outline"
            className="rounded-full"
          >
            <FileSpreadsheet className="mr-1.5 size-3.5" />
            Export Excel
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-primary/20 bg-primary/10 p-1.5 text-primary">
          {TAB_ITEMS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="rounded-lg px-3 py-2 text-xs font-medium text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-primary/15 data-[state=inactive]:hover:text-primary"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {data.overview ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Élèves"
                  value={String(data.overview.students)}
                  description={`${data.overview.teachers} ens. · ${data.overview.parents} parents`}
                  icon={Users}
                  tone="cyan"
                />
                <ReportKpiCard
                  title="Présence élèves"
                  value={`${data.overview.attendanceRate}%`}
                  icon={UserCheck}
                  tone="green"
                />
                <ReportKpiCard
                  title="Budget / Récolté"
                  value={money(data.overview.recoltes)}
                  description={`Budget ${money(data.overview.budget)} · reste ${money(data.overview.reste)}`}
                  icon={Banknote}
                  tone="blue"
                />
                <ReportKpiCard
                  title="Réussite"
                  value={`${data.overview.successRate}%`}
                  description={`Satisfaction ${data.overview.satisfaction}/5`}
                  icon={GraduationCap}
                  tone="orange"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection
                  title="Comparaison inter-branches"
                  description="Effectifs et encaissements par établissement."
                >
                  <ReportBarChart
                    data={data.overview.comparison.map((c) => ({
                      name: c.branchName,
                      élèves: c.students,
                      récoltes: c.recoltes,
                    }))}
                    config={{
                      élèves: { label: "Élèves", color: "hsl(221 83% 53%)" },
                      récoltes: {
                        label: "Récoltes",
                        color: "hsl(142 71% 45%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection
                  title="Synthèse RH & inscriptions"
                  description="Embauches et inscriptions validées."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReportKpiCard
                      title="Embauches"
                      value={String(data.overview.hired)}
                      icon={Briefcase}
                      tone="slate"
                    />
                    <ReportKpiCard
                      title="Inscriptions"
                      value={String(data.overview.registrations)}
                      icon={ClipboardList}
                      tone="rose"
                    />
                    <ReportKpiCard
                      title="Personnel"
                      value={String(data.overview.personnel)}
                      icon={UserRound}
                    />
                    <ReportKpiCard
                      title="Satisfaction"
                      value={`${data.overview.satisfaction}/5`}
                      icon={Smile}
                      tone="green"
                    />
                  </div>
                </ReportSection>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="effectifs" className="mt-4 space-y-4">
          {data.effectifs ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Élèves"
                  value={String(data.effectifs.students.total)}
                  description={`${data.effectifs.students.active} actifs / ${data.effectifs.students.inactive} inactifs`}
                  icon={Users}
                />
                <ReportKpiCard
                  title="Parents"
                  value={String(data.effectifs.parents.total)}
                  description={`${data.effectifs.parents.active} actifs`}
                  icon={UserCheck}
                  tone="cyan"
                />
                <ReportKpiCard
                  title="Enseignants"
                  value={String(data.effectifs.teachers.total)}
                  description={`${data.effectifs.teachers.active} actifs`}
                  icon={GraduationCap}
                  tone="green"
                />
                <ReportKpiCard
                  title="Personnel"
                  value={String(data.effectifs.personnel.total)}
                  description={`${data.effectifs.personnel.active} actifs`}
                  icon={UserRound}
                  tone="orange"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Élèves par sexe">
                  <ReportDonutChart
                    data={data.effectifs.students.byGender}
                    config={genderConfig}
                  />
                </ReportSection>
                <ReportSection title="Élèves actifs / inactifs">
                  <ReportDonutChart
                    data={data.effectifs.students.byStatus}
                    config={{
                      Actifs: { label: "Actifs", color: "hsl(142 71% 45%)" },
                      Inactifs: {
                        label: "Inactifs",
                        color: "hsl(25 95% 53%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Élèves par classe">
                  <ReportBarChart
                    data={data.effectifs.students.byClass.map((c) => ({
                      name: c.name,
                      total: c.total,
                      garçons: c.boys,
                      filles: c.girls,
                    }))}
                    config={{
                      total: { label: "Total", color: "hsl(221 83% 53%)" },
                      garçons: { label: "Garçons", color: "hsl(189 94% 43%)" },
                      filles: { label: "Filles", color: "hsl(340 75% 55%)" },
                    }}
                    stacked
                  />
                </ReportSection>
                <ReportSection title="Effectifs par branche">
                  <ReportBarChart
                    data={data.effectifs.byBranch.map((b) => ({
                      name: b.branchName,
                      élèves: b.students,
                      enseignants: b.teachers,
                      personnel: b.personnel,
                      parents: b.parents,
                    }))}
                    config={{
                      élèves: { label: "Élèves", color: "hsl(221 83% 53%)" },
                      enseignants: {
                        label: "Enseignants",
                        color: "hsl(142 71% 45%)",
                      },
                      personnel: {
                        label: "Personnel",
                        color: "hsl(25 95% 53%)",
                      },
                      parents: { label: "Parents", color: "hsl(189 94% 43%)" },
                    }}
                  />
                </ReportSection>
              </div>

              <ReportDataTable
                title="Détail par classe"
                columns={["Classe", "Total", "Garçons", "Filles"]}
                rows={data.effectifs.students.byClass.map((c) => [
                  c.name,
                  c.total,
                  c.boys,
                  c.girls,
                ])}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="presences" className="mt-4 space-y-4">
          {data.attendance && presence ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["students", "Élèves"],
                    ["teachers", "Enseignants"],
                    ["personnel", "Personnel"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={presenceTrack === key ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setPresenceTrack(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Pointages"
                  value={String(presence.total)}
                  icon={ClipboardList}
                />
                <ReportKpiCard
                  title="Taux de présence"
                  value={`${presence.presentRate}%`}
                  icon={TrendingUp}
                  tone="green"
                />
                {presence.byStatus.slice(0, 2).map((s) => (
                  <ReportKpiCard
                    key={s.key}
                    title={s.name}
                    value={String(s.value)}
                    icon={UserCheck}
                    tone="cyan"
                  />
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Répartition des statuts">
                  <ReportDonutChart
                    data={presence.byStatus}
                    config={Object.fromEntries(
                      presence.byStatus.map((s, i) => [
                        s.name,
                        {
                          label: s.name,
                          color: [
                            "hsl(142 71% 45%)",
                            "hsl(0 72% 51%)",
                            "hsl(25 95% 53%)",
                            "hsl(221 83% 53%)",
                          ][i],
                        },
                      ]),
                    )}
                  />
                </ReportSection>
                <ReportSection title="Évolution mensuelle">
                  <ReportBarChart
                    data={presence.byMonth.map((m) => ({
                      name: m.label,
                      présents: m.present,
                      absents: m.absent,
                      retards: m.late,
                      excusés: m.excused,
                    }))}
                    stacked
                    config={{
                      présents: {
                        label: "Présents",
                        color: "hsl(142 71% 45%)",
                      },
                      absents: { label: "Absents", color: "hsl(0 72% 51%)" },
                      retards: { label: "Retards", color: "hsl(25 95% 53%)" },
                      excusés: { label: "Excusés", color: "hsl(221 83% 53%)" },
                    }}
                  />
                </ReportSection>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="finance" className="mt-4 space-y-4">
          {data.finance ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Budget annuel"
                  value={money(data.finance.budgetAnnuel)}
                  description={
                    data.finance.budgetSource === "invoices"
                      ? `Factures · ${meta.currency.baseCurrency}`
                      : `Frais × inscriptions · ${meta.currency.baseCurrency}`
                  }
                  icon={Banknote}
                />
                <ReportKpiCard
                  title="Récolté"
                  value={money(data.finance.recoltes)}
                  description="Paiements validés"
                  icon={TrendingUp}
                  tone="green"
                />
                <ReportKpiCard
                  title="Reste (impayés)"
                  value={money(data.finance.reste)}
                  description={`Budget − encaissé · recouvrement ${data.finance.tauxRecouvrement}%`}
                  icon={TrendingDown}
                  tone="orange"
                />
                <ReportKpiCard
                  title="Dépenses / Solde"
                  value={money(data.finance.solde)}
                  description={`Dépenses ${money(data.finance.depenses)}`}
                  icon={Banknote}
                  tone="cyan"
                />
              </div>

              {meta.currency.rateLabel ? (
                <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
                  Taux sélectionné de l&apos;organisation :{" "}
                  <span className="font-semibold">{meta.currency.rateLabel}</span>
                  {" · "}Montants affichés en{" "}
                  <span className="font-semibold">{currency}</span>
                </p>
              ) : (
                <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
                  Devise de base :{" "}
                  <span className="font-semibold">{currency}</span>
                </p>
              )}

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <ReportSection title="Encaissements & dépenses">
                  <ReportAreaChart
                    data={data.finance.byMonth}
                    xKey="label"
                    config={{
                      recoltes: {
                        label: "Récoltes",
                        color: "hsl(221 83% 53%)",
                      },
                      depenses: {
                        label: "Dépenses",
                        color: "hsl(25 95% 53%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Taux de recouvrement">
                  <ReportRadialChart
                    value={data.finance.tauxRecouvrement}
                    label="Recouvrement"
                  />
                </ReportSection>
                <ReportSection title="Budget / récolté / reste par branche">
                  <ReportBarChart
                    data={data.finance.byBranch.map((b) => ({
                      name: b.branchName,
                      budget: b.budget,
                      récolté: b.recoltes,
                      reste: b.reste,
                    }))}
                    config={{
                      budget: { label: "Budget", color: "hsl(221 83% 53%)" },
                      récolté: { label: "Récolté", color: "hsl(142 71% 45%)" },
                      reste: { label: "Reste", color: "hsl(25 95% 53%)" },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Méthodes de paiement">
                  <ReportDonutChart
                    data={data.finance.byMethod}
                    config={Object.fromEntries(
                      data.finance.byMethod.map((m, i) => [
                        m.name,
                        {
                          label: m.name,
                          color: [
                            "hsl(221 83% 53%)",
                            "hsl(142 71% 45%)",
                            "hsl(25 95% 53%)",
                            "hsl(189 94% 43%)",
                          ][i % 4],
                        },
                      ]),
                    )}
                  />
                </ReportSection>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="satisfaction" className="mt-4 space-y-4">
          {data.satisfaction ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Note moyenne"
                  value={`${data.satisfaction.averageRating}/5`}
                  icon={Smile}
                  tone="green"
                />
                <ReportKpiCard
                  title="% positifs (≥4)"
                  value={`${data.satisfaction.positiveRate}%`}
                  icon={TrendingUp}
                />
                <ReportKpiCard
                  title="Avis reçus"
                  value={String(data.satisfaction.totalFeedbacks)}
                  icon={ClipboardList}
                  tone="cyan"
                />
                <ReportKpiCard
                  title="Taux de réponse"
                  value={`${data.satisfaction.responseRate}%`}
                  description={`${data.satisfaction.parentsCount} parents`}
                  icon={Users}
                  tone="orange"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Évolution mensuelle de la note">
                  <ReportAreaChart
                    data={data.satisfaction.byMonth.map((m) => ({
                      label: m.label,
                      moyenne: m.average,
                    }))}
                    config={{
                      moyenne: {
                        label: "Moyenne",
                        color: "hsl(142 71% 45%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Distribution des notes">
                  <ReportBarChart
                    data={data.satisfaction.byRating}
                    config={{
                      value: { label: "Avis", color: "hsl(221 83% 53%)" },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Par branche">
                  <ReportBarChart
                    data={data.satisfaction.byBranch.map((b) => ({
                      name: b.branchName,
                      moyenne: b.average,
                      positifs: b.positiveRate,
                    }))}
                    config={{
                      moyenne: {
                        label: "Moyenne",
                        color: "hsl(142 71% 45%)",
                      },
                      positifs: {
                        label: "% positifs",
                        color: "hsl(221 83% 53%)",
                      },
                    }}
                  />
                </ReportSection>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="resultats" className="mt-4 space-y-4">
          {data.results ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Moyenne générale"
                  value={`${data.results.averageScore}%`}
                  icon={GraduationCap}
                />
                <ReportKpiCard
                  title="Taux de réussite"
                  value={`${data.results.successRate}%`}
                  icon={TrendingUp}
                  tone="green"
                />
                <ReportKpiCard
                  title="Élèves notés"
                  value={String(data.results.studentsCount)}
                  icon={Users}
                  tone="cyan"
                />
                <ReportKpiCard
                  title="Admis (≥50%)"
                  value={String(data.results.passedCount)}
                  icon={UserCheck}
                  tone="orange"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Moyennes par classe">
                  <ReportBarChart
                    data={data.results.byClass.map((c) => ({
                      name: c.name,
                      moyenne: c.average,
                      réussite: c.successRate,
                    }))}
                    config={{
                      moyenne: {
                        label: "Moyenne %",
                        color: "hsl(221 83% 53%)",
                      },
                      réussite: {
                        label: "Réussite %",
                        color: "hsl(142 71% 45%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Par sexe">
                  <ReportBarChart
                    data={data.results.byGender.map((g) => ({
                      name: g.name,
                      moyenne: g.average,
                      réussite: g.successRate,
                    }))}
                    config={{
                      moyenne: {
                        label: "Moyenne %",
                        color: "hsl(221 83% 53%)",
                      },
                      réussite: {
                        label: "Réussite %",
                        color: "hsl(340 75% 55%)",
                      },
                    }}
                  />
                </ReportSection>
              </div>
              <ReportDataTable
                title="Détail par classe"
                columns={["Classe", "Moyenne %", "Réussite %", "Effectif"]}
                rows={data.results.byClass.map((c) => [
                  c.name,
                  c.average,
                  c.successRate,
                  c.count,
                ])}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="rh" className="mt-4 space-y-4">
          {data.hiring ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Candidatures"
                  value={String(data.hiring.total)}
                  icon={Briefcase}
                />
                <ReportKpiCard
                  title="Acceptées"
                  value={String(data.hiring.accepted)}
                  icon={TrendingUp}
                  tone="green"
                />
                <ReportKpiCard
                  title="Refusées"
                  value={String(data.hiring.rejected)}
                  icon={TrendingDown}
                  tone="orange"
                />
                <ReportKpiCard
                  title="Embauchées"
                  value={String(data.hiring.hired)}
                  description={`Taux embauche ${data.hiring.hireRate}%`}
                  icon={UserCheck}
                  tone="cyan"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Pipeline des candidatures">
                  <ReportFunnelChart data={data.hiring.byStatus} />
                </ReportSection>
                <ReportSection title="Type de poste">
                  <ReportDonutChart
                    data={data.hiring.byType}
                    config={{
                      Enseignant: {
                        label: "Enseignant",
                        color: "hsl(221 83% 53%)",
                      },
                      Personnel: {
                        label: "Personnel",
                        color: "hsl(142 71% 45%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Volume mensuel">
                  <ReportBarChart
                    data={data.hiring.byMonth.map((m) => ({
                      name: m.label,
                      total: m.total,
                      embauches: m.hired,
                    }))}
                    config={{
                      total: { label: "Candidatures", color: "hsl(221 83% 53%)" },
                      embauches: {
                        label: "Embauches",
                        color: "hsl(142 71% 45%)",
                      },
                    }}
                  />
                </ReportSection>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="inscriptions" className="mt-4 space-y-4">
          {data.registrations ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Demandes"
                  value={String(data.registrations.total)}
                  icon={ClipboardList}
                />
                <ReportKpiCard
                  title="Inscrites"
                  value={String(data.registrations.registered)}
                  icon={UserCheck}
                  tone="green"
                />
                <ReportKpiCard
                  title="Refusées"
                  value={String(data.registrations.rejected)}
                  icon={TrendingDown}
                  tone="orange"
                />
                <ReportKpiCard
                  title="Conversion"
                  value={`${data.registrations.conversionRate}%`}
                  description={`${data.registrations.pending} en cours`}
                  icon={TrendingUp}
                  tone="cyan"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Funnel inscriptions">
                  <ReportFunnelChart data={data.registrations.byStatus} />
                </ReportSection>
                <ReportSection title="Volume mensuel">
                  <ReportBarChart
                    data={data.registrations.byMonth.map((m) => ({
                      name: m.label,
                      total: m.total,
                      inscrites: m.registered,
                    }))}
                    config={{
                      total: { label: "Demandes", color: "hsl(221 83% 53%)" },
                      inscrites: {
                        label: "Inscrites",
                        color: "hsl(142 71% 45%)",
                      },
                    }}
                  />
                </ReportSection>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
