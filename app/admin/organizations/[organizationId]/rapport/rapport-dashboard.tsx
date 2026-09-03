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
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

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
import { exportRapportCompletPdf } from "./export-rapport-effectifs-pdf";
import { exportRapportOrganisationExcel } from "./export-rapport-excel";
import { FinanceStudentDetailsTable } from "./finance-student-details-table";
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
  { value: "paie", label: "Paie du personnel" },
  { value: "credits", label: "Crédits" },
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
    data.meta.selectedBranchIds.length > 0
      ? data.meta.selectedBranchIds.join(",")
      : "all",
  );
  params.set("schoolYearKey", data.meta.schoolYearKey);
  params.set("classeKey", data.meta.classeKey || "all");
  return `/admin/organizations/${organizationId}/rapport?${params.toString()}`;
}

export function RapportDashboard({ organizationId, data }: Props) {
  const router = useRouter();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
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
    router.push(buildTabHref(organizationId, data, next as ReportTab), {
      scroll: false,
    });
  }

  async function exportExcel() {
    setExportingExcel(true);
    try {
      await exportRapportOrganisationExcel({
        meta: data.meta,
        tab,
        overview: data.overview,
        effectifs: data.effectifs,
        attendance: data.attendance,
        finance: data.finance,
        payroll: data.payroll,
        credits: data.credits,
        satisfaction: data.satisfaction,
        results: data.results,
        hiring: data.hiring,
        registrations: data.registrations,
      });
      toast.success(
        tab === "overview"
          ? "Export Excel complet généré."
          : `Export Excel — onglet « ${TAB_ITEMS.find((t) => t.value === tab)?.label ?? tab} » généré.`,
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de générer l'export Excel.",
      );
    } finally {
      setExportingExcel(false);
    }
  }

  async function exportPdf() {
    setExportingPdf(true);
    try {
      const context = await getRapportReportContextAction({
        organizationId,
        branchId:
          meta.selectedBranchIds.length > 0
            ? meta.selectedBranchIds.join(",")
            : meta.selectedBranchId,
      });
      await exportRapportCompletPdf(
        {
          meta: data.meta,
          tab,
          overview: data.overview,
          effectifs: data.effectifs,
          attendance: data.attendance,
          finance: data.finance,
          payroll: data.payroll,
          credits: data.credits,
          satisfaction: data.satisfaction,
          results: data.results,
          hiring: data.hiring,
          registrations: data.registrations,
        },
        context,
      );
      toast.success(
        tab === "overview"
          ? "Rapport PDF complet généré."
          : `Rapport PDF — onglet « ${TAB_ITEMS.find((t) => t.value === tab)?.label ?? tab} » généré.`,
      );
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
          Effectifs, présences, finance, paie du personnel, crédits,
          satisfaction, résultats, RH et inscriptions. L&apos;export PDF / Excel
          reprend l&apos;onglet actif (détails + totaux) — la vue d&apos;ensemble
          exporte tout.
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
          classes={meta.classes}
          scope={meta.scope}
          selectedBranchId={meta.selectedBranchId}
          selectedBranchIds={meta.selectedBranchIds}
          schoolYearKey={meta.schoolYearKey}
          classeKey={meta.classeKey}
          tab={tab}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            type="button"
            onClick={exportPdf}
            disabled={exportingPdf || exportingExcel}
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
            disabled={exportingPdf || exportingExcel}
            variant="outline"
            className="rounded-full"
          >
            {exportingExcel ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-1.5 size-3.5" />
            )}
            {exportingExcel ? "Export…" : "Export Excel"}
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
                <ReportKpiCard
                  title="Paie nette"
                  value={money(data.overview.payrollNet)}
                  description={`${data.overview.payrollCount} bulletin(s) · brut ${money(data.overview.payrollGross)}`}
                  icon={Wallet}
                  tone="slate"
                />
                <ReportKpiCard
                  title="Crédits accordés"
                  value={money(data.overview.creditsApproved)}
                  description={`${data.overview.creditsCount} demande(s) · reste ${money(data.overview.creditsOutstanding)}`}
                  icon={Banknote}
                  tone="rose"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection
                  title="Comparaison inter-branches"
                  description="Effectifs, encaissements et paie par établissement."
                >
                  <ReportBarChart
                    data={data.overview.comparison.map((c) => ({
                      name: c.branchName,
                      élèves: c.students,
                      récoltes: c.recoltes,
                      paie: c.payrollNet,
                    }))}
                    config={{
                      élèves: { label: "Élèves", color: "hsl(221 83% 53%)" },
                      récoltes: {
                        label: "Récoltes",
                        color: "hsl(142 71% 45%)",
                      },
                      paie: {
                        label: "Paie nette",
                        color: "hsl(25 95% 53%)",
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

              <ReportDataTable
                title="Détails — Comparaison inter-branches"
                columns={[
                  "Branche",
                  "Élèves",
                  "Récoltes",
                  "Paie nette",
                  "Crédits",
                  "Satisfaction",
                  "Réussite %",
                ]}
                rows={data.overview.comparison.map((c) => [
                  c.branchName,
                  c.students,
                  money(c.recoltes),
                  money(c.payrollNet),
                  money(c.creditsApproved),
                  c.satisfaction,
                  c.successRate,
                ])}
              />
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
                title="Totaux — Par classe"
                columns={["Classe", "Total", "Garçons", "Filles"]}
                rows={data.effectifs.students.byClass.map((c) => [
                  c.name,
                  c.total,
                  c.boys,
                  c.girls,
                ])}
              />

              <ReportDataTable
                title="Détail — Liste des élèves"
                columns={[
                  "#",
                  "Matricule",
                  "Nom",
                  "Postnom",
                  "Prénom",
                  "Sexe",
                  "Statut",
                  "Branche",
                  "Classe",
                ]}
                rows={data.effectifs.students.list.map((p, i) => [
                  i + 1,
                  p.matricule,
                  p.nom,
                  p.postnom,
                  p.prenom,
                  p.sexe,
                  p.statut,
                  p.branche,
                  p.classe ?? "—",
                ])}
              />
              <ReportDataTable
                title="Détail — Liste des parents"
                columns={[
                  "#",
                  "Matricule",
                  "Nom",
                  "Postnom",
                  "Prénom",
                  "Sexe",
                  "Statut",
                  "Branche",
                ]}
                rows={data.effectifs.parents.list.map((p, i) => [
                  i + 1,
                  p.matricule,
                  p.nom,
                  p.postnom,
                  p.prenom,
                  p.sexe,
                  p.statut,
                  p.branche,
                ])}
              />
              <ReportDataTable
                title="Détail — Liste des enseignants"
                columns={[
                  "#",
                  "Matricule",
                  "Nom",
                  "Postnom",
                  "Prénom",
                  "Sexe",
                  "Statut",
                  "Branche",
                ]}
                rows={data.effectifs.teachers.list.map((p, i) => [
                  i + 1,
                  p.matricule,
                  p.nom,
                  p.postnom,
                  p.prenom,
                  p.sexe,
                  p.statut,
                  p.branche,
                ])}
              />
              <ReportDataTable
                title="Détail — Liste du personnel"
                columns={[
                  "#",
                  "Matricule",
                  "Nom",
                  "Postnom",
                  "Prénom",
                  "Sexe",
                  "Statut",
                  "Branche",
                ]}
                rows={data.effectifs.personnel.list.map((p, i) => [
                  i + 1,
                  p.matricule,
                  p.nom,
                  p.postnom,
                  p.prenom,
                  p.sexe,
                  p.statut,
                  p.branche,
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

              <ReportDataTable
                title="Mensuels"
                columns={[
                  "Mois",
                  "Présents",
                  "Absents",
                  "Retards",
                  "Excusés",
                  "Total",
                ]}
                rows={presence.byMonth.map((m) => [
                  m.label,
                  m.present,
                  m.absent,
                  m.late,
                  m.excused,
                  m.total,
                ])}
              />
              <ReportDataTable
                title="Synthèse — Personnes absentes ou en retard"
                columns={[
                  "#",
                  "Matricule",
                  "Nom",
                  "Classe / Rôle",
                  "Branche",
                  "Absents",
                  "Retards",
                  "Total abs./ret.",
                ]}
                rows={presence.details.map((p, i) => [
                  i + 1,
                  p.matricule,
                  p.name,
                  p.role,
                  p.branch,
                  p.absent,
                  p.late,
                  p.absent + p.late,
                ])}
              />
              <ReportDataTable
                title="Détails — Absents et retards (par date)"
                columns={[
                  "#",
                  "Date",
                  "Heure début",
                  "Heure fin",
                  "Matricule",
                  "Nom",
                  "Classe / Rôle",
                  "Branche",
                  "Statut",
                  "Remarque",
                ]}
                rows={presence.incidents.map((p, i) => [
                  i + 1,
                  p.date,
                  p.time,
                  p.endTime,
                  p.matricule,
                  p.name,
                  p.role,
                  p.branch,
                  p.status,
                  p.remark,
                ])}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="finance" className="mt-4 space-y-4">
          {data.finance ? (
            <>
              <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
                Filtre : année{" "}
                <span className="font-semibold">
                  {meta.schoolYearKey === "all"
                    ? "toutes"
                    : meta.schoolYearKey}
                </span>
                {" · "}classe{" "}
                <span className="font-semibold">
                  {meta.classeKey === "all"
                    ? "toutes"
                    : (meta.classes.find((c) => c.key === meta.classeKey)
                        ?.label ?? meta.classeKey)}
                </span>
                {meta.currency.rateLabel
                  ? ` · ${meta.currency.rateLabel}`
                  : ` · ${currency}`}
              </p>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Total dû (élèves)"
                  value={money(data.finance.totalsStudents.due)}
                  description={`${data.finance.totalsStudents.count} élève(s)`}
                  icon={Banknote}
                />
                <ReportKpiCard
                  title="Total payé"
                  value={money(data.finance.totalsStudents.paid)}
                  description="Paiements validés"
                  icon={TrendingUp}
                  tone="green"
                />
                <ReportKpiCard
                  title="Total reste"
                  value={money(data.finance.totalsStudents.reste)}
                  description={`Recouvrement ${data.finance.tauxRecouvrement}%`}
                  icon={TrendingDown}
                  tone="orange"
                />
                <ReportKpiCard
                  title="Budget / Récolté"
                  value={money(data.finance.recoltes)}
                  description={`Budget ${money(data.finance.budgetAnnuel)}`}
                  icon={Banknote}
                  tone="cyan"
                />
              </div>

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

              <ReportDataTable
                title="Totaux — Par mois"
                columns={[
                  "Mois",
                  `Récoltes (${currency})`,
                  `Dépenses (${currency})`,
                ]}
                rows={data.finance.byMonth.map((m) => [
                  m.label,
                  money(m.recoltes),
                  money(m.depenses),
                ])}
              />
              <ReportDataTable
                title="Totaux — Par branche"
                columns={["Branche", "Budget", "Récolté", "Reste", "Dépenses"]}
                rows={data.finance.byBranch.map((b) => [
                  b.branchName,
                  money(b.budget),
                  money(b.recoltes),
                  money(b.reste),
                  money(b.depenses),
                ])}
              />

              <FinanceStudentDetailsTable
                studentDetails={data.finance.studentDetails}
                money={money}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="paie" className="mt-4 space-y-4">
          {data.payroll ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Bulletins"
                  value={String(data.payroll.count)}
                  description={`${data.payroll.teacherCount} ens. · ${data.payroll.personnelCount} pers. · ${data.payroll.bothCount} double`}
                  icon={ClipboardList}
                />
                <ReportKpiCard
                  title="Brut"
                  value={money(data.payroll.gross)}
                  icon={Banknote}
                  tone="cyan"
                />
                <ReportKpiCard
                  title="Retenues"
                  value={money(data.payroll.deductions)}
                  icon={TrendingDown}
                  tone="orange"
                />
                <ReportKpiCard
                  title="Net à payer"
                  value={money(data.payroll.net)}
                  description={`Payé ${money(data.payroll.paidNet)} · ${data.payroll.paidCount} payé(s)`}
                  icon={Wallet}
                  tone="green"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Par mois">
                  <ReportBarChart
                    data={data.payroll.byMonth.map((m) => ({
                      name: m.label,
                      brut: m.gross,
                      retenues: m.deductions,
                      net: m.net,
                    }))}
                    config={{
                      brut: { label: "Brut", color: "hsl(221 83% 53%)" },
                      retenues: {
                        label: "Retenues",
                        color: "hsl(25 95% 53%)",
                      },
                      net: { label: "Net", color: "hsl(142 71% 45%)" },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Statut des bulletins">
                  <ReportDonutChart
                    data={data.payroll.byStatus}
                    config={Object.fromEntries(
                      data.payroll.byStatus.map((s, i) => [
                        s.name,
                        {
                          label: s.name,
                          color: [
                            "hsl(221 83% 53%)",
                            "hsl(45 93% 47%)",
                            "hsl(142 71% 45%)",
                            "hsl(0 72% 51%)",
                          ][i % 4],
                        },
                      ]),
                    )}
                  />
                </ReportSection>
                <ReportSection title="Par branche">
                  <ReportBarChart
                    data={data.payroll.byBranch.map((b) => ({
                      name: b.branchName,
                      brut: b.gross,
                      net: b.net,
                      payé: b.paidNet,
                    }))}
                    config={{
                      brut: { label: "Brut", color: "hsl(221 83% 53%)" },
                      net: { label: "Net", color: "hsl(142 71% 45%)" },
                      payé: { label: "Payé", color: "hsl(189 94% 43%)" },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Type d'agent">
                  <ReportDonutChart
                    data={data.payroll.byKind}
                    config={{
                      Enseignant: {
                        label: "Enseignant",
                        color: "hsl(221 83% 53%)",
                      },
                      Personnel: {
                        label: "Personnel",
                        color: "hsl(142 71% 45%)",
                      },
                      "Les deux": {
                        label: "Les deux",
                        color: "hsl(25 95% 53%)",
                      },
                    }}
                  />
                </ReportSection>
              </div>
              <ReportDataTable
                title="Totaux — Par mois"
                columns={["Mois", "Bulletins", "Brut", "Retenues", "Net"]}
                rows={data.payroll.byMonth.map((m) => [
                  m.label,
                  m.count,
                  money(m.gross),
                  money(m.deductions),
                  money(m.net),
                ])}
              />
              <ReportDataTable
                title="Totaux — Par branche"
                columns={["Branche", "Bulletins", "Brut", "Retenues", "Net", "Payé"]}
                rows={data.payroll.byBranch.map((b) => [
                  b.branchName,
                  b.count,
                  money(b.gross),
                  money(b.deductions),
                  money(b.net),
                  money(b.paidNet),
                ])}
              />
              <ReportDataTable
                title="Détail — Bulletins de paie"
                columns={[
                  "#",
                  "Agent",
                  "Type",
                  "Branche",
                  "Période",
                  "Statut",
                  "Brut",
                  "Retenues",
                  "Net",
                ]}
                rows={data.payroll.payslips.map((p, i) => [
                  i + 1,
                  p.agentName,
                  p.agentKindLabel,
                  p.branchName,
                  p.period,
                  p.statusLabel,
                  money(p.gross),
                  money(p.deductions),
                  money(p.net),
                ])}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="credits" className="mt-4 space-y-4">
          {data.credits ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                  title="Demandes"
                  value={String(data.credits.count)}
                  description={`${data.credits.pendingCount} en attente`}
                  icon={ClipboardList}
                />
                <ReportKpiCard
                  title="Demandé"
                  value={money(data.credits.requestedAmount)}
                  icon={Banknote}
                />
                <ReportKpiCard
                  title="Accordé"
                  value={money(data.credits.approvedAmount)}
                  description={`${data.credits.approvedCount} accordé(s) · ${data.credits.settledCount} soldé(s)`}
                  icon={TrendingUp}
                  tone="green"
                />
                <ReportKpiCard
                  title="Reste à déduire"
                  value={money(data.credits.outstandingAmount)}
                  description={`Déduit ${money(data.credits.deductedAmount)}`}
                  icon={Wallet}
                  tone="orange"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ReportSection title="Volume mensuel">
                  <ReportBarChart
                    data={data.credits.byMonth.map((m) => ({
                      name: m.label,
                      demandes: m.count,
                      montant: m.amount,
                    }))}
                    config={{
                      demandes: {
                        label: "Demandes",
                        color: "hsl(221 83% 53%)",
                      },
                      montant: {
                        label: "Montant",
                        color: "hsl(25 95% 53%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Statut des crédits">
                  <ReportDonutChart
                    data={data.credits.byStatus}
                    config={Object.fromEntries(
                      data.credits.byStatus.map((s, i) => [
                        s.name,
                        {
                          label: s.name,
                          color: [
                            "hsl(45 93% 47%)",
                            "hsl(142 71% 45%)",
                            "hsl(0 72% 51%)",
                            "hsl(221 83% 53%)",
                            "hsl(215 16% 47%)",
                          ][i % 5],
                        },
                      ]),
                    )}
                  />
                </ReportSection>
                <ReportSection title="Par branche">
                  <ReportBarChart
                    data={data.credits.byBranch.map((b) => ({
                      name: b.branchName,
                      demandé: b.requested,
                      accordé: b.approved,
                      reste: b.outstanding,
                    }))}
                    config={{
                      demandé: {
                        label: "Demandé",
                        color: "hsl(221 83% 53%)",
                      },
                      accordé: {
                        label: "Accordé",
                        color: "hsl(142 71% 45%)",
                      },
                      reste: {
                        label: "Reste",
                        color: "hsl(25 95% 53%)",
                      },
                    }}
                  />
                </ReportSection>
                <ReportSection title="Type d'agent">
                  <ReportDonutChart
                    data={data.credits.byKind}
                    config={{
                      Enseignant: {
                        label: "Enseignant",
                        color: "hsl(221 83% 53%)",
                      },
                      Personnel: {
                        label: "Personnel",
                        color: "hsl(142 71% 45%)",
                      },
                      "Les deux": {
                        label: "Les deux",
                        color: "hsl(25 95% 53%)",
                      },
                    }}
                  />
                </ReportSection>
              </div>
              <ReportDataTable
                title="Totaux — Par branche"
                columns={["Branche", "Demandes", "Demandé", "Accordé", "Reste"]}
                rows={data.credits.byBranch.map((b) => [
                  b.branchName,
                  b.count,
                  money(b.requested),
                  money(b.approved),
                  money(b.outstanding),
                ])}
              />
              <ReportDataTable
                title="Détail — Crédits / avances sur salaire"
                columns={[
                  "#",
                  "Agent",
                  "Type",
                  "Branche",
                  "Montant",
                  "Séances",
                  "Déduites",
                  "Reste",
                  "Statut",
                  "1re séance",
                  "Motif",
                ]}
                rows={data.credits.advances.map((a, i) => [
                  i + 1,
                  a.agentName,
                  a.kindLabel,
                  a.branchName,
                  money(a.amount),
                  a.installmentCount,
                  a.deductedCount,
                  money(a.outstanding),
                  a.statusLabel,
                  a.period,
                  a.reason,
                ])}
              />
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
              <ReportDataTable
                title="Détails — Par branche"
                columns={["Branche", "Moyenne", "% positifs", "Avis"]}
                rows={data.satisfaction.byBranch.map((b) => [
                  b.branchName,
                  b.average,
                  b.positiveRate,
                  b.count,
                ])}
              />
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
              <ReportDataTable
                title="Détails — Par statut"
                columns={["Statut", "Volume"]}
                rows={data.hiring.byStatus.map((s) => [s.name, s.value])}
              />
              <ReportDataTable
                title="Détails — Par branche"
                columns={["Branche", "Total", "Embauchés", "Refusés"]}
                rows={data.hiring.byBranch.map((b) => [
                  b.branchName,
                  b.total,
                  b.hired,
                  b.rejected,
                ])}
              />
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
              <ReportDataTable
                title="Détails — Par statut"
                columns={["Statut", "Volume"]}
                rows={data.registrations.byStatus.map((s) => [s.name, s.value])}
              />
              <ReportDataTable
                title="Détails — Par branche"
                columns={["Branche", "Demandes", "Inscrites", "Refusées"]}
                rows={data.registrations.byBranch.map((b) => [
                  b.branchName,
                  b.total,
                  b.registered,
                  b.rejected,
                ])}
              />
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
