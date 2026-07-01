"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { ResponsiveDataTable } from "@/components/custom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getFichesGroupedByCoursAnnee } from "@/lib/actions";
import { DataTableToolbar } from "./data-table-toolbar";

interface FichecentralTableProps {
  refreshKey?: string;
  organizationId: string;
  branchId: string;
}

type FicheTableRow = {
  id: string;
  teacherName: string;
  lessonId: string;
  subjectName: string;
  classId: string;
  className: string;
  periodId: number;
  periodName: string;
  anneeId: string;
  anneeName: string;
  status: boolean;
  ficheCoteId?: string | null;
  nombreIntervention: number;
  uiStatus: "Validée" | "En attente";
};

const getFicheHref = (
  fiche: FicheTableRow,
  organizationId: string,
  branchId: string,
) =>
  `/admin/organizations/${organizationId}/branches/${branchId}/ficheCentrales/${fiche.lessonId}?classId=${fiche.classId}&periodId=${fiche.periodId}&anneeId=${fiche.anneeId}`;

const includesText = (value: unknown, filterValue: unknown) => {
  const text = String(value ?? "").toLowerCase();
  const filter = String(filterValue ?? "").toLowerCase();
  return text.includes(filter);
};

const includesArrayValue = (value: unknown, filterValue: unknown) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
  return filterValue.includes(String(value ?? ""));
};

const getColumns = (
  organizationId: string,
  branchId: string,
): ColumnDef<FicheTableRow>[] => [
  {
    accessorKey: "id",
    header: "N° Fiche",
    cell: ({ row }) =>
      row.original.id ? `${row.original.id.slice(0, 8)}...` : "N/A",
  },
  {
    accessorKey: "teacherName",
    header: "Teacher",
  },
  {
    accessorKey: "className",
    header: "Classe",
    filterFn: (row, id, value) => {
      if (Array.isArray(value)) return includesArrayValue(row.getValue(id), value);
      return includesText(row.getValue(id), value);
    },
  },
  {
    accessorKey: "subjectName",
    header: "Cours",
    cell: ({ row }) => (
      <span className="text-green-600">{row.original.subjectName}</span>
    ),
    filterFn: (row, id, value) => {
      if (Array.isArray(value)) return includesArrayValue(row.getValue(id), value);
      return includesText(row.getValue(id), value);
    },
  },
  {
    accessorKey: "periodName",
    header: "Période",
    filterFn: (row, id, value) => {
      if (Array.isArray(value)) return includesArrayValue(row.getValue(id), value);
      return includesText(row.getValue(id), value);
    },
  },
  {
    accessorKey: "anneeName",
    header: "Année",
    filterFn: (row, id, value) => {
      if (Array.isArray(value)) return includesArrayValue(row.getValue(id), value);
      return includesText(row.getValue(id), value);
    },
  },
  {
    accessorKey: "nombreIntervention",
    header: "Interventions",
  },
  {
    accessorKey: "uiStatus",
    header: "Statut",
    cell: ({ row }) =>
      row.original.uiStatus === "Validée" ? (
        <StatusBadge status="active" label="Validée" />
      ) : (
        <StatusBadge status="pending" label="En attente" />
      ),
    filterFn: (row, id, value) => includesArrayValue(row.getValue(id), value),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button asChild variant="outline" size="sm">
        <Link href={getFicheHref(row.original, organizationId, branchId)}>
          <Eye className="h-4 w-4" />
          Voir / Valider
        </Link>
      </Button>
    ),
  },
];

const FichecentralTable: React.FC<FichecentralTableProps> = ({
  organizationId,
  branchId,
}) => {
  const [fiches, setFiches] = useState<FicheTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const columns = useMemo(
    () => getColumns(organizationId, branchId),
    [organizationId, branchId],
  );

  useEffect(() => {
    const fetchFiches = async () => {
      try {
        setLoading(true);
        const data = await getFichesGroupedByCoursAnnee();
        setFiches(
          data.map((fiche) => ({
            id: fiche.id,
            teacherName: fiche.teacherName || "N/A",
            lessonId: fiche.lessonId,
            subjectName: fiche.subjectName || "N/A",
            classId: fiche.classId,
            className: fiche.className || "N/A",
            periodId: fiche.periodId,
            periodName: fiche.periodName || "N/A",
            anneeId: fiche.anneeId,
            anneeName: fiche.anneeName || "N/A",
            status: fiche.status,
            ficheCoteId: fiche.ficheCoteId ?? null,
            nombreIntervention: fiche.nombreIntervention,
            uiStatus:
              fiche.status === true && fiche.ficheCoteId
                ? "Validée"
                : "En attente",
          })),
        );
      } catch (error) {
        console.error("Erreur chargement fiches:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiches();
  }, []);

  const tableData = useMemo(() => fiches, [fiches]);

  if (loading) {
    return <div className="p-2 text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <ResponsiveDataTable
      ToolbarComponent={DataTableToolbar}
      columns={columns}
      data={tableData}
      emptyText="Aucune fiche enregistrée"
      mobileCardTitle={(row) => row.subjectName}
      mobileCardSubtitle={(row) => `${row.className} - ${row.periodName}`}
      mobileCardBadges={(row) => [
        { label: row.anneeName || "Aucune année", variant: "secondary" },
        { label: row.uiStatus, variant: row.uiStatus === "Validée" ? "outline" : "secondary" },
      ]}
      mobileCardActions={(row) => (
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link href={getFicheHref(row, organizationId, branchId)}>
            <Eye className="h-4 w-4" />
            Voir / Valider
          </Link>
        </Button>
      )}
    />
  );
};

export default FichecentralTable;
