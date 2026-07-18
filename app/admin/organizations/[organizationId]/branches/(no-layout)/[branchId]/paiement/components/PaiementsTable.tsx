"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  IPaiement,
  ModePaiement,
  StatusPaiement,
} from "@/src/interfaces/Paiement";
import {
  getAllPaiementAction,
  getPaymentReportContextAction,
} from "../paiement.action";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { Eye, FileSpreadsheet, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import { ReceiptPreviewDialog } from "@/components/reports/ReceiptPreviewDialog";
import type { SchoolReportContext } from "@/lib/reports/types";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import { toast } from "sonner";
import {
  exportPaiementsReportPdf,
  type PaiementReportPeriod,
} from "./export-paiements-pdf";

type GroupedPaiement = {
  reference: string;
  parentName: string;
  students: string[];
  total: number;
  status: StatusPaiement;
  mode: ModePaiement;
  date: Date;
  items: IPaiement[];
};

function mapPaiement(p: any): IPaiement {
  return {
    id: p.id,
    numeroRecu: p.id,
    montantPaye: Number(p.amount),
    modePaiement: p.method,
    status: p.status,
    datePaiement: new Date(p.createdAt),

    transactionRef: p.transactionRef,
    notes: p.notes ?? undefined,

    frais: p.frais
      ? {
          id: p.frais.id,
          nameFrais: p.frais.nameFrais,
          montantFrais: Number(p.frais.montantFrais),
        }
      : undefined,

    classEnrollment: p.classEnrollment
      ? {
          id: p.classEnrollment.id,
          nom: p.classEnrollment.nom,
          prenom: p.classEnrollment.prenom,
          sexe: p.classEnrollment.sexe,
          nameClasse: p.classEnrollment.nameClasse,
          nameYear: p.classEnrollment.nameYear,
          parentId: p.classEnrollment.parentId,
          parentName: p.classEnrollment.parentNom,
          parentPrenom: p.classEnrollment.parentPrenom,
        }
      : undefined,

    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.createdAt),
  };
}

function mapGroupedToReceipt(
  g: GroupedPaiement,
  branding: SchoolReportContext,
): FacturePaymentStudentData {
  const classNames = Array.from(
    new Set(
      g.items
        .map((i) => i.classEnrollment?.nameClasse?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const sexes = Array.from(
    new Set(
      g.items
        .map((i) => i.classEnrollment?.sexe?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  );

  return {
    invoiceNumber: g.reference,
    sender: {
      name: branding.branchName || branding.schoolName || "Établissement",
      address: branding.address ?? "",
    },
    recipient: {
      name: g.students.join(", ") || "Élève",
      class: classNames.join(", ") || "-",
      sexe: sexes.join(", ") || "-",
    },
    items: g.items.map((i) => ({
      description: i.frais?.nameFrais || "Frais scolaire",
      price: Number(i.frais?.montantFrais ?? i.montantPaye),
      statut: i.status,
      montant: Number(i.montantPaye),
    })),
    logoUrl: branding.logoUrl,
    exchangeRateUsdCdf:
      branding.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF,
    issuedPlace: branding.city,
  };
}

const PaiementsTable = ({ refreshKey }: { refreshKey?: string }) => {
  const [paiements, setPaiements] = useState<IPaiement[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("today");

  const [receiptData, setReceiptData] =
    useState<FacturePaymentStudentData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptIssuedAt, setReceiptIssuedAt] = useState<Date | undefined>();
  const [branding, setBranding] = useState<SchoolReportContext | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [data, error] = await getAllPaiementAction();

      if (error || !data) {
        setPaiements([]);
        setLoading(false);
        return;
      }

      setPaiements(data.map(mapPaiement));
      setLoading(false);
    };

    fetchData();
  }, [refreshKey]);

  useEffect(() => {
    const loadBranding = async () => {
      const [context, err] = await getPaymentReportContextAction();
      if (err || !context) return;
      setBranding(context);
    };
    loadBranding();
  }, []);

  const openReceipt = (g: GroupedPaiement) => {
    if (!branding) {
      toast.error("Contexte établissement indisponible pour le reçu.");
      return;
    }
    setReceiptData(mapGroupedToReceipt(g, branding));
    setReceiptIssuedAt(g.date);
    setReceiptOpen(true);
  };

  const formatStudents = (students: string[]) => {
    if (!students || students.length === 0) return "Aucun élève";

    if (students.length <= 5) return students.join(", ");

    return `${students.slice(0, 2).join(", ")} ...`;
  };

  const grouped = useMemo<GroupedPaiement[]>(() => {
    const map = new Map<string, IPaiement[]>();

    for (const p of paiements) {
      const ref =
        p.transactionRef && p.transactionRef.trim() !== ""
          ? p.transactionRef
          : `NO_REF_${p.id}`;

      if (!map.has(ref)) map.set(ref, []);
      map.get(ref)!.push(p);
    }

    return Array.from(map.entries()).map(([ref, items]) => {
      const first = items[0];

      const students = Array.from(
        new Set(
          items.map((i) =>
            `${i.classEnrollment?.prenom ?? ""} ${i.classEnrollment?.nom ?? ""}`.trim(),
          ),
        ),
      ).filter(Boolean);

      return {
        reference: ref,
        parentName: `${first.classEnrollment?.parentPrenom ?? ""} ${
          first.classEnrollment?.parentName ?? ""
        }`.trim(),

        students,

        total: items.reduce((sum, i) => sum + i.montantPaye, 0),
        status: first.status,
        mode: first.modePaiement,
        date: first.datePaiement,
        items,
      };
    });
  }, [paiements]);

  const getDateRange = (filter: string) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date(start);

    switch (filter) {
      case "week": {
        const day = start.getDay();
        const diff = (day + 6) % 7;
        start.setDate(start.getDate() - diff);
        end = new Date(start);
        end.setDate(start.getDate() + 7);
        break;
      }
      case "month": {
        start.setDate(1);
        end = new Date(start);
        end.setMonth(start.getMonth() + 1);
        break;
      }
      case "year": {
        start.setMonth(0, 1);
        end = new Date(start);
        end.setFullYear(start.getFullYear() + 1);
        break;
      }
      case "today":
      default:
        end = new Date(start);
        end.setDate(start.getDate() + 1);
        break;
    }

    return { start, end };
  };

  const dateRangeOptions = [
    { value: "today", label: "Aujourd'hui" },
    { value: "week", label: "Cette semaine" },
    { value: "month", label: "Ce mois" },
    { value: "year", label: "Année" },
  ];

  const filtered = useMemo<GroupedPaiement[]>(() => {
    const s = searchTerm.toLowerCase();
    const { start, end } = getDateRange(dateRangeFilter);

    return grouped.filter((g) => {
      const matchSearch =
        g.reference.toLowerCase().includes(s) ||
        g.parentName.toLowerCase().includes(s) ||
        g.students.some((st) => st.toLowerCase().includes(s));

      const matchStatus =
        statusFilter === "all" || String(g.status) === statusFilter;

      const matchMode = modeFilter === "all" || String(g.mode) === modeFilter;

      const matchDate = g.date >= start && g.date < end;

      return matchSearch && matchStatus && matchMode && matchDate;
    });
  }, [grouped, searchTerm, statusFilter, modeFilter, dateRangeFilter]);

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      let context = branding;
      if (!context) {
        const [fresh, err] = await getPaymentReportContextAction();
        if (err || !fresh) {
          throw new Error(
            err?.message ||
              "Impossible de charger les informations du rapport.",
          );
        }
        context = fresh;
        setBranding(fresh);
      }

      await exportPaiementsReportPdf(filtered, context, {
        period: dateRangeFilter as PaiementReportPeriod,
        statusFilter,
        modeFilter,
      });
      toast.success("Le rapport PDF des paiements a été généré.");
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
  };

  const getModeLabel = (m: ModePaiement) => {
    switch (m) {
      case ModePaiement.ESPECES:
        return "Espèces";
      case ModePaiement.MPESA:
        return "Mpesa";
      case ModePaiement.AIRTEL_MONEY:
        return "Airtel Money";
      case ModePaiement.ORANGE_MONEY:
        return "Orange Money";
      case ModePaiement.CARTE:
        return "Carte Bancaire";
      case ModePaiement.BANQUE:
        return "Banque";
      default:
        return "Inconnu";
    }
  };

  const getStatus = (s: StatusPaiement) => {
    switch (s) {
      case StatusPaiement.VALIDE:
        return <StatusBadge status="active" label="Validé" />;
      case StatusPaiement.ANNULE:
        return <StatusBadge status="cancelled" label="Annulé" />;
      case StatusPaiement.EN_ATTENTE:
        return <StatusBadge status="pending" label="En attente" />;
      case StatusPaiement.REMBOURSE:
        return <StatusBadge status="completed" label="Remboursé" />;
      default:
        return <StatusBadge status="inactive" label="Inconnu" />;
    }
  };

  const statusOptions = [
    { value: "all", label: "Tous" },
    { value: StatusPaiement.VALIDE, label: "Validé" },
    { value: StatusPaiement.EN_ATTENTE, label: "En attente" },
    { value: StatusPaiement.ANNULE, label: "Annulé" },
  ].map((o, i) => ({
    ...o,
    value: String(o.value),
    key: `status-${i}`,
  }));

  const modeOptions = [
    { value: "all", label: "Tous" },
    { value: ModePaiement.ESPECES, label: "Espèces" },
    { value: ModePaiement.MPESA, label: "Mpesa" },
    { value: ModePaiement.AIRTEL_MONEY, label: "Airtel" },
    { value: ModePaiement.ORANGE_MONEY, label: "Orange" },
  ].map((o, i) => ({
    ...o,
    value: String(o.value),
    key: `mode-${i}`,
  }));

  const exchangeRate =
    branding?.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF;

  const columns = [
    {
      key: "reference",
      header: "Référence",
      cell: (g: GroupedPaiement) => g.reference,
    },
    {
      key: "parent",
      header: "Parent",
      cell: (g: GroupedPaiement) => g.parentName,
    },
    {
      key: "students",
      header: "Élèves",
      cell: (g: GroupedPaiement) => formatStudents(g.students),
    },
    {
      key: "usd",
      header: "USD",
      cell: (g: GroupedPaiement) =>
        g.total.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
    },
    {
      key: "total",
      header: "Total (CDF)",
      cell: (g: GroupedPaiement) =>
        (g.total * exchangeRate).toLocaleString("fr-FR", {
          style: "currency",
          currency: "CDF",
        }),
    },
    {
      key: "mode",
      header: "Mode",
      cell: (g: GroupedPaiement) => getModeLabel(g.mode),
    },
    {
      key: "status",
      header: "Statut",
      cell: (g: GroupedPaiement) => getStatus(g.status),
    },
    {
      key: "actions",
      header: "",
      cell: (g: GroupedPaiement) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openReceipt(g)}>
              <Eye className="mr-2 h-4 w-4" />
              Voir reçu
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const cardConfig = {
    title: (g: GroupedPaiement) => g.reference,
    subtitle: (g: GroupedPaiement) => g.parentName,
    details: (g: GroupedPaiement) => [
      { label: "Élèves", value: g.students.join(", ") },
      {
        label: "Total",
        value: (g.total * exchangeRate).toLocaleString("fr-FR", {
          style: "currency",
          currency: "CDF",
        }),
      },
    ],
    actions: () => [],
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <SearchAndFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <SearchAndFilter
          filterValue={dateRangeFilter}
          onFilterChange={setDateRangeFilter}
          filterOptions={dateRangeOptions}
        />

        <SearchAndFilter
          filterValue={statusFilter}
          onFilterChange={setStatusFilter}
          filterOptions={statusOptions}
        />

        <SearchAndFilter
          filterValue={modeFilter}
          onFilterChange={setModeFilter}
          filterOptions={modeOptions}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={exportFilteredPdf}
          disabled={exportingPdf || filtered.length === 0}
          className="border-sky-600 text-sky-600! hover:bg-sky-600/10 focus-visible:border-sky-600 focus-visible:ring-sky-600/20 dark:border-sky-400 dark:text-sky-400! dark:hover:bg-sky-400/10 dark:focus-visible:border-sky-400 dark:focus-visible:ring-sky-400/40"
        >
          <FileSpreadsheet data-icon="inline-start" />
          {exportingPdf ? "Génération..." : "Export PDF"}
        </Button>
      </div>

      <ReceiptPreviewDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        data={receiptData}
        title="Reçu de paiement"
        issuedAt={receiptIssuedAt}
      />

      <ResponsiveDataTable
        data={filtered}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
      />
    </div>
  );
};

export default PaiementsTable;
