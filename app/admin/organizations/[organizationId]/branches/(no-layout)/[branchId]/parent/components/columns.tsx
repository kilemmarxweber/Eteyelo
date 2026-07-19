"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { IconDots } from "@tabler/icons-react";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteParentDialog } from "./delete-parent-dialog";
import { DetailsParentDialog } from "./details-parent-dialog";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { IParent } from "@/src/interfaces/Parent";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { ResetUsersDialog } from "../../student/components/reset-users-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export type ParentTableActions = {
  onEdit: (parent: IParent) => void;
};

export const createParentColumns = (
  actions?: ParentTableActions,
): ColumnDef<IParent>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "nom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="nom" />
    ),
    cell: ({ row }) => {
      return row.original.nom ?? "N/A";
    },
    filterFn: (row, id, value) => {
      const search = String(value).toLowerCase().trim();
      const nom = String(row.getValue("nom") ?? "").toLowerCase();
      const postnom = String(row.getValue("postnom") ?? "").toLowerCase();
      const prenom = String(row.getValue("prenom") ?? "").toLowerCase();

      return (
        nom.includes(search) ||
        postnom.includes(search) ||
        prenom.includes(search)
      );
    },
  },
  {
    accessorKey: "postnom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Identifiant" />
    ),
    cell: ({ row }) => {
      return row.original.postnom ?? "N/A";
    },
  },
  {
    accessorKey: "prenom",
    header: "Prenom",
    cell: ({ row }) => {
      return row.original.prenom ?? "N/A";
    },
  },
  {
    accessorKey: "sexe",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sexe" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex items-center">
          <span>{row.original.sexe}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const raw = String(row.getValue(id) ?? "").toLowerCase();
      const selected = (Array.isArray(value) ? value : [value]).map((v) =>
        String(v).toLowerCase(),
      );
      return selected.some((v) => {
        if (v === "masculin" || v === "m") return raw === "m" || raw === "masculin";
        if (v === "feminin" || v === "f") return raw === "f" || raw === "feminin";
        return raw === v;
      });
    },
  },
  {
    id: "statusUser",
    accessorFn: (row) => (row.statusUser === false ? "archived" : "active"),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Statut" />
    ),
    cell: ({ row }) => {
      return row.original.statusUser === false ? "Archivé" : "Actif";
    },
    filterFn: (row, id, value) => {
      const selected = Array.isArray(value) ? value : [value];
      return selected.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "dateOfBirth",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date creation" />
    ),
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
  },

  {
    accessorKey: "telephone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Telephone" />
    ),
    cell: ({ row }) => {
      return (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`tel:${row.original.telephone}`}
        >
          {row.original.telephone ?? "N/A"}
        </Link>
      );
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => {
      return (
        <div>
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href={`mailto:${row.original.email}`}
          >
            {row.original.email ?? "N/A"}
          </Link>
        </div>
      );
    },
  },

  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);
      const params = useParams<{ organizationId: string; branchId: string }>();

      return (
        <>
          <DetailsParentDialog
            open={showDetailsTaskDialog}
            onOpenChange={setShowDetailsTaskDialog}
            parent={row.original}
          />

          <DeleteParentDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            parents={[row.original]}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />

          <ResetUsersDialog
            open={showResetTaskDialog}
            onOpenChange={setShowResetTaskDialog}
            email={row.original.email || ""}
            organizationId={params.organizationId}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0 data-[state= open]:bg-muted"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {/* Ajout de l'option Edit */}
              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                Détails
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  if (!actions) return;
                  openOverlayAfterMenuDismiss(() => actions.onEdit(row.original));
                }}
              >
                Modifier
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={() => setShowResetTaskDialog(true)}>
                Reunitialiser
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowDeleteTaskDialog(true)}>
                Archiver
                <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];

export const columns = createParentColumns();
