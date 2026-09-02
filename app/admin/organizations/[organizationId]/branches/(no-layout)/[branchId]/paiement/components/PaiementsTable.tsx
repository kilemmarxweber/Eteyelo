"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  IPaiement,
  ModePaiement,
  StatusPaiement,
} from "@/src/interfaces/Paiement";
import {
  deletePaiementAction,
  getAllPaiementAction,
  getPaymentReportContextAction,
} from "../paiement.action";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { Eye, FileSpreadsheet, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import { ReceiptPreviewDialog } from "@/components/reports/ReceiptPreviewDialog";
import type { SchoolReportContext } from "@/lib/reports/types";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { resolveOverallReceiptSettlementStatus } from "@/lib/reports/receipt-settlement";
import {
  exportPaiementsReportPdf,
  type PaiementReportPeriod,
} from "./export-paiements-pdf";
import { formatReportAmount } from "@/lib/reports/format-amount";

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
    receivedCurrency: p.receivedCurrency ?? "USD",
    receivedAmount:
      p.receivedAmount != null ? Number(p.receivedAmount) : Number(p.amount),
    exchangeRateUsed:
      p.exchangeRateUsed != null ? Number(p.exchangeRateUsed) : null,
    modePaiement: p.method,
    status: p.status,
    datePaiement: new Date(p.createdAt),

    transactionRef: p.transactionRef,
    notes: p.notes ?? undefined,
    settlementStatus: p.settlementStatus ?? undefined,

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
          codeClasse: p.classEnrollment.codeClasse,
          nameYear: p.classEnrollment.nameYear,
          parentId: p.classEnrollment.parentId,
          parentName: p.classEnrollment.parentNom,
          parentPrenom: p.classEnrollment.parentPrenom,
          parentPostnom: p.classEnrollment.parentPostnom,
        }
      : undefined,

    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.createdAt),
  };
}

function mapGroupedToReceipt(
  g: GroupedPaiement,
  branding: SchoolReportContext,
  labels: { parentFallback: string; establishment: string; schoolFee: string },
): FacturePaymentStudentData {
  const receivedCurrency =
    g.items.find((i) => i.receivedCurrency)?.receivedCurrency ??
    branding.baseCurrency ??
    "USD";

  return {
    invoiceNumber: g.reference,
    sender: {
      name: branding.branchName || branding.schoolName || labels.establishment,
      address: branding.address ?? "",
    },
    recipient: {
      name: g.parentName.trim() || labels.parentFallback,
    },
    items: g.items.map((i) => ({
      description: i.frais?.nameFrais || labels.schoolFee,
      price: Number(i.frais?.montantFrais ?? i.montantPaye),
      mode: String(i.modePaiement || ModePaiement.ESPECES),
      montant: Number(i.montantPaye),
      receivedAmount:
        i.receivedAmount != null
          ? Number(i.receivedAmount)
          : Number(i.montantPaye),
      classe: i.classEnrollment?.nameClasse ?? "",
      codeClasse: i.classEnrollment?.codeClasse ?? "",
      settlementStatus: i.settlementStatus,
    })),
    settlementStatus: resolveOverallReceiptSettlementStatus(g.items),
    logoUrl: branding.logoUrl,
    exchangeRateUsdCdf:
      branding.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF,
    issuedPlace: branding.city,
    receivedCurrency,
    baseCurrency: branding.baseCurrency ?? "USD",
    quoteCurrency: branding.quoteCurrency,
    selectedRate: branding.selectedRate,
    showConversion: branding.showConversion !== false,
    receiptPrintFormat: branding.receiptPrintFormat,
  };
}

const PaiementsTable = ({
  refreshKey,
  onChanged,
}: {
  refreshKey?: string;
  onChanged?: () => void;
}) => {
  const t = useTranslations("finance");
  const tCommon = useTranslations("common");
  const peopleLabels = useBranchPeopleLabels();
  const { data: session, isPending: sessionPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const canDeletePayment =
    hasMounted && !sessionPending && isOrganizationOwnerSession(session);
  const [paiements, setPaiements] = useState<IPaiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<GroupedPaiement | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

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
    setHasMounted(true);
  }, []);

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
      toast.error(t("table.receiptContextFailed"));
      return;
    }
    setReceiptData(
      mapGroupedToReceipt(g, branding, {
        parentFallback: t("table.parent"),
        establishment: t("table.establishment"),
        schoolFee: t("schoolFeeFallback"),
      }),
    );
    setReceiptIssuedAt(g.date);
    setReceiptOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !canDeletePayment) return;
    const ids = pendingDelete.items.map((item) => item.id).filter(Boolean);
    if (ids.length === 0) {
      toast.error(t("table.deletePaymentError"));
      return;
    }

    setDeleting(true);
    try {
      const [, error] = await deletePaiementAction({ ids });
      if (error) {
        toast.error(error.message || t("table.deletePaymentError"));
        return;
      }
      toast.success(t("table.deletePaymentSuccess"));
      setPaiements((current) => current.filter((p) => !ids.includes(p.id)));
      setPendingDelete(null);
      onChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("table.deletePaymentError"),
      );
    } finally {
      setDeleting(false);
    }
  };

  const formatStudents = (students: string[]) => {
    if (!students || students.length === 0) return peopleLabels.noneLabel;

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
        parentName: [
          first.classEnrollment?.parentPrenom,
          first.classEnrollment?.parentName,
          first.classEnrollment?.parentPostnom,
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),

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
    { value: "today", label: t("table.today") },
    { value: "week", label: t("table.week") },
    { value: "month", label: t("table.month") },
    { value: "year", label: t("table.year") },
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
            err?.message || t("table.contextFailed"),
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
      toast.success(t("table.pdfSuccess"));
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : t("table.pdfError"),
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const getModeLabel = (m: ModePaiement) => {
    switch (m) {
      case ModePaiement.ESPECES:
        return t("modes.ESPECES");
      case ModePaiement.MPESA:
        return t("modes.MPESA");
      case ModePaiement.AIRTEL_MONEY:
        return t("modes.AIRTEL_MONEY");
      case ModePaiement.ORANGE_MONEY:
        return t("modes.ORANGE_MONEY");
      case ModePaiement.CARTE:
        return t("modes.CARTE");
      case ModePaiement.BANQUE:
        return t("modes.BANQUE");
      default:
        return t("modes.unknown");
    }
  };

  const getStatus = (s: StatusPaiement) => {
    switch (s) {
      case StatusPaiement.VALIDE:
        return <StatusBadge status="active" label={t("status.VALIDE")} />;
      case StatusPaiement.ANNULE:
        return <StatusBadge status="cancelled" label={t("status.ANNULE")} />;
      case StatusPaiement.EN_ATTENTE:
        return <StatusBadge status="pending" label={t("status.EN_ATTENTE")} />;
      case StatusPaiement.REMBOURSE:
        return <StatusBadge status="completed" label={t("status.REMBOURSE")} />;
      default:
        return <StatusBadge status="inactive" label={t("status.unknown")} />;
    }
  };

  const statusOptions = [
    { value: "all", label: t("table.all") },
    { value: StatusPaiement.VALIDE, label: t("status.VALIDE") },
    { value: StatusPaiement.EN_ATTENTE, label: t("status.EN_ATTENTE") },
    { value: StatusPaiement.ANNULE, label: t("status.ANNULE") },
  ].map((o, i) => ({
    ...o,
    value: String(o.value),
    key: `status-${i}`,
  }));

  const modeOptions = [
    { value: "all", label: t("table.all") },
    { value: ModePaiement.ESPECES, label: t("modes.ESPECES") },
    { value: ModePaiement.MPESA, label: t("modes.MPESA") },
    { value: ModePaiement.AIRTEL_MONEY, label: t("table.airtel") },
    { value: ModePaiement.ORANGE_MONEY, label: t("table.orange") },
  ].map((o, i) => ({
    ...o,
    value: String(o.value),
    key: `mode-${i}`,
  }));

  const exchangeRate =
    branding?.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF;
  const baseCurrency = branding?.baseCurrency ?? "USD";
  const showConversion = branding?.showConversion !== false;
  const quoteCurrency =
    branding?.quoteCurrency ??
    (baseCurrency === "AOA" || baseCurrency === "CDF" ? "USD" : "CDF");

  const columns = [
    {
      key: "reference",
      header: t("table.reference"),
      cell: (g: GroupedPaiement) => g.reference,
    },
    {
      key: "parent",
      header: t("table.parent"),
      cell: (g: GroupedPaiement) => g.parentName,
    },
    {
      key: "students",
      header: peopleLabels.studentPlural,
      cell: (g: GroupedPaiement) => formatStudents(g.students),
    },
    {
      key: "base",
      header: baseCurrency,
      cell: (g: GroupedPaiement) =>
        formatReportAmount(g.total, baseCurrency),
    },
    {
      key: "total",
      header: t("table.totalQuote", { currency: quoteCurrency }),
      cell: (g: GroupedPaiement) => {
        if (baseCurrency === "USD" && quoteCurrency === "CDF") {
          return formatReportAmount(g.total * exchangeRate, "CDF");
        }
        if (baseCurrency !== "USD" && quoteCurrency === "USD") {
          const usd =
            exchangeRate > 0 && baseCurrency === "CDF"
              ? g.total / exchangeRate
              : g.total;
          // AOA→USD uses stored received amounts when available; fallback display
          const first = g.items[0];
          if (
            first?.receivedCurrency === "USD" &&
            first.receivedAmount != null &&
            g.total > 0
          ) {
            const ratio =
              Number(first.receivedAmount) /
              Number(first.montantPaye || g.total);
            return formatReportAmount(g.total * ratio, "USD");
          }
          return formatReportAmount(usd, "USD");
        }
        return formatReportAmount(g.total, quoteCurrency);
      },
    },
    {
      key: "mode",
      header: t("table.mode"),
      cell: (g: GroupedPaiement) => getModeLabel(g.mode),
    },
    {
      key: "status",
      header: t("table.status"),
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
              {t("table.viewReceipt")}
            </DropdownMenuItem>
            {canDeletePayment ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setPendingDelete(g)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("table.deletePayment")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const visibleColumns = showConversion
    ? columns
    : columns.filter((c) => c.key !== "total");

  const cardConfig = {
    title: (g: GroupedPaiement) => g.reference,
    subtitle: (g: GroupedPaiement) => g.parentName,
    details: (g: GroupedPaiement) => [
      { label: peopleLabels.studentPlural, value: g.students.join(", ") },
      {
        label: t("table.total"),
        value: formatReportAmount(g.total, baseCurrency),
      },
    ],
    actions: (g: GroupedPaiement) => [
      {
        label: t("table.viewReceipt"),
        icon: Eye,
        onClick: () => openReceipt(g),
      },
      ...(canDeletePayment
        ? [
            {
              label: t("table.deletePayment"),
              icon: Trash2,
              onClick: () => setPendingDelete(g),
              variant: "destructive" as const,
            },
          ]
        : []),
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <SearchAndFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("table.search")}
        />

        <SearchAndFilter
          filterValue={dateRangeFilter}
          onFilterChange={setDateRangeFilter}
          filterOptions={dateRangeOptions}
          filterPlaceholder={t("table.filter")}
        />

        <SearchAndFilter
          filterValue={statusFilter}
          onFilterChange={setStatusFilter}
          filterOptions={statusOptions}
          filterPlaceholder={t("table.filter")}
        />

        <SearchAndFilter
          filterValue={modeFilter}
          onFilterChange={setModeFilter}
          filterOptions={modeOptions}
          filterPlaceholder={t("table.filter")}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={exportFilteredPdf}
          disabled={exportingPdf || filtered.length === 0}
          className="border-sky-600 text-sky-600! hover:bg-sky-600/10 focus-visible:border-sky-600 focus-visible:ring-sky-600/20 dark:border-sky-400 dark:text-sky-400! dark:hover:bg-sky-400/10 dark:focus-visible:border-sky-400 dark:focus-visible:ring-sky-400/40"
        >
          <FileSpreadsheet data-icon="inline-start" />
          {exportingPdf ? t("table.generating") : t("table.exportPdf")}
        </Button>
      </div>

      <ReceiptPreviewDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        data={receiptData}
        title={t("table.receiptTitle")}
        issuedAt={receiptIssuedAt}
      />

      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("table.deletePaymentTitle")}</DialogTitle>
            <DialogDescription>
              {t("table.deletePaymentDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleting ? t("table.deleting") : t("table.deletePayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResponsiveDataTable
        data={filtered}
        columns={visibleColumns}
        cardConfig={cardConfig}
        loading={loading}
      />
    </div>
  );
};

export default PaiementsTable;
