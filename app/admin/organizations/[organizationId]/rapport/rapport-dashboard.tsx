"use client";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Banknote,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  PieChart,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";

type ReportData = Awaited<
  ReturnType<typeof import("./rapport.action").getOrganizationReportData>
>;

type Props = {
  organizationId: string;
  data: ReportData;
};

const COLORS = ["#2563eb", "#06b6d4", "#22c55e", "#f97316", "#8b5cf6"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function RapportDashboard({ organizationId, data }: Props) {
  const router = useRouter();

  const {
    branches,
    selectedBranchId,
    summary,
    studentsByClass,
    attendanceStats,
    genderStats,
    statusStats,
    financeByMonth,
  } = data;

  function onBranchChange(branchId: string) {
    router.push(
      `/admin/organizations/${organizationId}/rapport?branchId=${branchId}`,
    );
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          "Total élèves": summary.totalStudents,
          "Élèves actifs": summary.activeStudents,
          "Élèves inactifs": summary.inactiveStudents,
          Garçons: summary.boys,
          Filles: summary.girls,
          Enseignants: summary.teachers,
          Parents: summary.parents,
          Paiements: summary.totalPayments,
          Dépenses: summary.totalExpenses,
          Balance: summary.balance,
        },
      ]),
      "Résumé",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(financeByMonth),
      "Paiements Dépenses",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(studentsByClass),
      "Élèves par classe",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(genderStats),
      "Élèves par sexe",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(statusStats),
      "Statuts élèves",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(attendanceStats),
      "Présences",
    );

    XLSX.writeFile(workbook, "rapport-etablissement.xlsx");
  }

  function exportPdf() {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Rapport établissement", 14, 18);

    doc.setFontSize(10);
    doc.text("Tableau de bord analytique", 14, 26);

    autoTable(doc, {
      startY: 35,
      head: [["Indicateur", "Valeur"]],
      body: [
        ["Total élèves", summary.totalStudents],
        ["Élèves actifs", summary.activeStudents],
        ["Élèves inactifs", summary.inactiveStudents],
        ["Garçons", summary.boys],
        ["Filles", summary.girls],
        ["Enseignants", summary.teachers],
        ["Parents", summary.parents],
        ["Paiements", `${formatMoney(summary.totalPayments)} FC`],
        ["Dépenses", `${formatMoney(summary.totalExpenses)} FC`],
        ["Balance", `${formatMoney(summary.balance)} FC`],
      ],
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Mois", "Paiements", "Dépenses"]],
      body: financeByMonth.map((item) => [
        item.month,
        `${formatMoney(item.paiements)} FC`,
        `${formatMoney(item.depenses)} FC`,
      ]),
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Classe", "Total élèves"]],
      body: studentsByClass.map((item) => [item.name, item.total]),
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Présence", "Total"]],
      body: attendanceStats.map((item) => [item.name, item.value]),
    });

    doc.save("rapport-etablissement.pdf");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <section className="overflow-hidden rounded-2xl bg-blue-950 p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-50">
              <BarChart3 className="size-3.5" />
              Rapports & statistiques
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Tableau de bord analytique
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">
              Suivez les paiements, dépenses, élèves, présences, enseignants et
              parents selon chaque établissement.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <select
              value={selectedBranchId}
              onChange={(e) => onBranchChange(e.target.value)}
              className="h-8 rounded-full border border-white/20 bg-white px-3 text-sm font-medium text-blue-950 outline-none"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              type="button"
              onClick={exportPdf}
              variant="outline"
              className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white hover:text-blue-950"
            >
              <FileText className="mr-1.5 size-3.5" />
              Export PDF
            </Button>

            <Button
              size="sm"
              type="button"
              onClick={exportExcel}
              variant="outline"
              className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white hover:text-blue-950"
            >
              <FileSpreadsheet className="mr-1.5 size-3.5" />
              Export Excel
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Paiements"
          value={`${formatMoney(summary.totalPayments)} FC`}
          description="Total encaissé"
          icon={Banknote}
          tone="blue"
        />

        <StatCard
          title="Dépenses"
          value={`${formatMoney(summary.totalExpenses)} FC`}
          description="Total sorti"
          icon={TrendingDown}
          tone="orange"
        />

        <StatCard
          title="Balance"
          value={`${formatMoney(summary.balance)} FC`}
          description="Paiements - dépenses"
          icon={TrendingUp}
          tone="green"
        />

        <StatCard
          title="Élèves"
          value={summary.totalStudents.toString()}
          description={`${summary.activeStudents} actifs / ${summary.inactiveStudents} inactifs`}
          icon={Users}
          tone="cyan"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniCard title="Garçons" value={summary.boys} icon={UserRound} />
        <MiniCard title="Filles" value={summary.girls} icon={UserRound} />
        <MiniCard
          title="Enseignants"
          value={summary.teachers}
          icon={GraduationCap}
        />
        <MiniCard title="Parents" value={summary.parents} icon={UserCheck} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <ChartCard
          title="Paiements & dépenses"
          description="Comparaison mensuelle des entrées et sorties."
        >
          <ResponsiveContainer width="100%" height={310}>
            <AreaChart data={financeByMonth}>
              <defs>
                <linearGradient id="paiements" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>

                <linearGradient id="depenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />

              <Area
                type="monotone"
                dataKey="paiements"
                stroke="#2563eb"
                fill="url(#paiements)"
                strokeWidth={3}
              />

              <Area
                type="monotone"
                dataKey="depenses"
                stroke="#f97316"
                fill="url(#depenses)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Élèves par sexe"
          description="Répartition garçons / filles."
        >
          <ResponsiveContainer width="100%" height={310}>
            <RePieChart>
              <Pie
                data={genderStats}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={105}
                paddingAngle={4}
              >
                {genderStats.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartCard
          title="Élèves par classe"
          description="Nombre d’élèves inscrits dans chaque classe."
        >
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={studentsByClass}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" radius={[12, 12, 0, 0]} fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Statut des élèves" description="Actifs et inactifs.">
          <ResponsiveContainer width="100%" height={330}>
            <RePieChart>
              <Pie
                data={statusStats}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={105}
                paddingAngle={4}
              >
                {statusStats.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[(index + 2) % COLORS.length]}
                  />
                ))}
              </Pie>

              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-black text-slate-950">
            Rapport de présence
          </h2>

          <p className="text-sm text-slate-500">
            Présents, absents, retards et excusés.
          </p>
        </div>

        <div className="grid gap-0 divide-y md:grid-cols-4 md:divide-x md:divide-y-0">
          {attendanceStats.map((item, index) => (
            <div key={item.name} className="p-5">
              <p className="text-sm font-semibold text-slate-500">
                {item.name}
              </p>

              <p className="mt-2 text-3xl font-black text-blue-950">
                {item.value}
              </p>

              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(item.value * 5, 100)}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Données paiements & dépenses"
          columns={["Mois", "Paiements", "Dépenses"]}
          rows={financeByMonth.map((item) => [
            item.month,
            `${formatMoney(item.paiements)} FC`,
            `${formatMoney(item.depenses)} FC`,
          ])}
        />

        <DataTable
          title="Données élèves par classe"
          columns={["Classe", "Total élèves"]}
          rows={studentsByClass.map((item) => [item.name, item.total])}
        />

        <DataTable
          title="Données élèves par sexe"
          columns={["Sexe", "Total"]}
          rows={genderStats.map((item) => [item.name, item.value])}
        />

        <DataTable
          title="Données statuts élèves"
          columns={["Statut", "Total"]}
          rows={statusStats.map((item) => [item.name, item.value])}
        />

        <DataTable
          title="Données présences"
          columns={["Statut", "Total"]}
          rows={attendanceStats.map((item) => [item.name, item.value])}
        />
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  tone: "blue" | "orange" | "green" | "cyan";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-600",
    cyan: "bg-cyan-50 text-cyan-600",
  };

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-1.5 text-xl font-bold text-slate-950">{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>

        <span
          className={`flex size-9 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function MiniCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-blue-950">{value}</p>
        </div>

        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>

        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <PieChart className="size-4" />
        </span>
      </div>

      {children}
    </section>
  );
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-5">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-blue-50 text-xs uppercase text-blue-950">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4">
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-t border-slate-100 transition hover:bg-blue-50/50"
                >
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  Aucune donnée disponible.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
