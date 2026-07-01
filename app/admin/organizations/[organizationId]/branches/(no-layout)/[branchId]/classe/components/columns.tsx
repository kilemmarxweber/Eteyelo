"use client";

import { ColumnDef } from "@tanstack/react-table";
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
import { DeleteClassesDialog } from "./delete-Classe-dialog";
import { UpdateClasseDialog } from "./edit-Classe-dialog";
import React from "react";
import { IClasse } from "@/src/interfaces/Classe";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
export const columns: ColumnDef<IClasse>[] = [
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
    accessorKey: "codeClasse",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code de la classe" />
    ),
    cell: ({ row }) => {
      return row.original.codeClasse;
    },
  },
  {
    accessorKey: "nameClasse",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom de la classe" />
    ),
    cell: ({ row }) => {
      return row.original.nameClasse;
    },
  },
  {
    accessorKey: "nameOption",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom de l'Option" />
    ),
    cell: ({ row }) => {
      return row.original.option?.nameOption;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "nameCreneau",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom de la vacation" />
    ),
    cell: ({ row }) => {
      return row.original.creneau?.nameCreneau;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="createdAt" />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const { data: session } = useSession();
      const canManageClasse = canManageOrganization(session);
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);

      return (
        <>
          {/* Dialogue ou feuille pour l'édition */}
          <UpdateClasseDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            classe={row.original} // Passerlesdonnéesactuellesdel'élèveonSuccess={() => row.toggleSelected(false)}
          />

          <DeleteClassesDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            Classes={[row.original]}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />

          <DropdownMenu>
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
              {/* Ajout de l'classe Edit */}
              {/* {canUpdate() && ( */}
              <DropdownMenuItem
                disabled={!canManageClasse}
                onSelect={() => setShowUpdateTaskSheet(true)}
              >
                Edit
              </DropdownMenuItem>
              {/* )} */}
              <DropdownMenuSeparator />
              {/* {canDelete() && ( */}
              <DropdownMenuItem
                disabled={!canManageClasse}
                onSelect={() => setShowDeleteTaskDialog(true)}
              >
                Delete
                <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
              {/* )} */}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
