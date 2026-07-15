"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteFicheCentrale } from "../fichecentrale.action";
import { IconClipboardList } from "@tabler/icons-react";

interface FichecentralTableProps {
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
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.id ? `${row.original.id.slice(0, 8)}…` : "N/A"}
      </span>
    ),
  },
  {
    accessorKey: "teacherName",
    header: "Enseignant",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.teacherName}</span>
    ),
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
      <span className="font-medium">{row.original.subjectName}</span>
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
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.nombreIntervention}</span>
    ),
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
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={getFicheHref(row.original, organizationId, branchId)}>
            <Eye className="size-3.5" />
            Voir
          </Link>
        </Button>
        <DeleteCentralFicheButton
          fiche={row.original}
          onDeleted={() => onDeleted(row.original.id)}
        />
      </div>
    ),
  },
];

export default function FichecentralTable({
  organizationId,
  branchId,
}: FichecentralTableProps) {
  const [fiches, setFiches] = useState<FicheTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const columns = useMemo(
    () =>
      getColumns(organizationId, branchId, (id) =>
        setFiches((current) => current.filter((item) => item.id !== id)),
      ),
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
        toast.error("Impossible de charger les fiches centrales.");
      } finally {
        setLoading(false);
      }
    };

    fetchFiches();
  }, []);

  if (loading) {
    return (
      <div className="flex w-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/10 px-6 py-12">
        <Loader2 className="size-6 shrink-0 animate-spin text-muted-foreground" />
        <p className="max-w-7xl text-center text-sm leading-relaxed text-muted-foreground text-balance">
          Chargement des fiches…
        </p>
      </div>
    );
  }

  if (fiches.length === 0) {
    return (
      <div className="flex w-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/10 px-6 py-12">
        <IconClipboardList className="size-8 shrink-0 text-muted-foreground/50" />
        <p className="max-w-7xl text-center text-sm leading-relaxed text-muted-foreground text-balance">
          Aucune fiche centrale en attente pour l&apos;année en cours.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveDataTable
      ToolbarComponent={DataTableToolbar}
      columns={columns}
      data={fiches}
      emptyText="Aucune fiche enregistrée"
      mobileCardTitle={(row) => row.subjectName}
      mobileCardSubtitle={(row) => `${row.className} · ${row.periodName}`}
      mobileCardBadges={(row) => [
        { label: row.anneeName || "Aucune année", variant: "secondary" },
        {
          label: row.uiStatus,
          variant: row.uiStatus === "Validée" ? "outline" : "secondary",
        },
      ]}
      mobileCardActions={(row) => (
        <div className="flex flex-1 gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
            <Link href={getFicheHref(row, organizationId, branchId)}>
              <Eye className="size-3.5" />
              Voir
            </Link>
          </Button>
          <DeleteCentralFicheButton
            fiche={row}
            onDeleted={() =>
              setFiches((current) => current.filter((item) => item.id !== row.id))
            }
          />
        </div>
      )}
    />
  );
}

function DeleteCentralFicheButton({
  fiche,
  onDeleted,
}: {
  fiche: FicheTableRow;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await deleteFicheCentrale({
        lessonId: fiche.lessonId,
        classId: fiche.classId,
        periodId: fiche.periodId,
        anneeId: fiche.anneeId,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      onDeleted();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-3.5" />
          <span className="sr-only">Supprimer</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer cette fiche centrale ?</DialogTitle>
          <DialogDescription>
            La fiche {fiche.uiStatus === "Validée" ? "validée" : "non validée"},
            sa fiche globale et ses {fiche.nombreIntervention} intervention(s)
            seront définitivement supprimées. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={remove}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
