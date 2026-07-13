"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveDataTable } from "@/components/custom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getFichesGroupedByCoursAnnee } from "@/lib/actions";
import { DataTableToolbar } from "./data-table-toolbar";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteFicheCentrale } from "../fichecentrale.action";

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
  onDeleted: (id: string) => void,
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
    cell: ({ row }) => <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm"><Link href={getFicheHref(row.original, organizationId, branchId)}><Eye className="h-4 w-4" />Voir / Valider</Link></Button>
      <DeleteCentralFicheButton fiche={row.original} onDeleted={() => onDeleted(row.original.id)} />
    </div>,
  },
];

const FichecentralTable: React.FC<FichecentralTableProps> = ({
  organizationId,
  branchId,
}) => {
  const [fiches, setFiches] = useState<FicheTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const columns = useMemo(
    () => getColumns(organizationId, branchId, id => setFiches(current => current.filter(item => item.id !== id))),
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
        <div className="flex flex-1 gap-2"><Button asChild variant="outline" size="sm" className="flex-1">
          <Link href={getFicheHref(row, organizationId, branchId)}>
            <Eye className="h-4 w-4" />
            Voir / Valider
          </Link>
        </Button><DeleteCentralFicheButton fiche={row} onDeleted={() => setFiches(current => current.filter(item => item.id !== row.id))} /></div>
      )}
    />
  );
};

function DeleteCentralFicheButton({ fiche, onDeleted }: { fiche: FicheTableRow; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = React.useTransition();
  const remove = () => startTransition(async () => {
    const result = await deleteFicheCentrale({ lessonId: fiche.lessonId, classId: fiche.classId, periodId: fiche.periodId, anneeId: fiche.anneeId });
    if (!result.success) { toast.error(result.message); return; }
    toast.success(result.message); setOpen(false); onDeleted();
  });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="destructive" size="sm"><Trash2 className="size-4" /><span className="sr-only">Supprimer</span></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Supprimer cette fiche centrale ?</DialogTitle><DialogDescription>La fiche {fiche.uiStatus === "Validée" ? "validée" : "non validée"}, sa fiche globale et ses {fiche.nombreIntervention} intervention(s) seront définitivement supprimées. Cette action est irréversible.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose><Button variant="destructive" disabled={pending} onClick={remove}>{pending && <Loader2 className="mr-2 size-4 animate-spin" />}Supprimer</Button></DialogFooter></DialogContent></Dialog>;
}

export default FichecentralTable;
