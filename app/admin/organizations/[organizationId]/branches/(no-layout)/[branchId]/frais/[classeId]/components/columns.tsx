"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import { ColumnDef } from "@tanstack/react-table";
import { IconArrowUp, IconDots } from "@tabler/icons-react";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UpdateFraisDialog } from "./edit-Frais-dialog";
import { DeleteFraissDialog } from "./delete-Frais-dialog";

import React from "react";
import { IFrais } from "@/src/interfaces/Frais";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";

export const columns: ColumnDef<IFrais>[] = [
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
    accessorKey: "nameFrais",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Intitulé du frais" />
    ),
    cell: ({ row }) => {
      return row.original.nameFrais ?? "N/A";
    },
  },
  {
    accessorKey: "montantFrais",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Montant" />
    ),
    cell: ({ row }) => {
      return row.original.montantFrais ?? "N/A";
    },
  },
  
  
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="inscris le " />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [isUpdatePending, startUpdateTransition] = useTransition();
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);

      return (
        <>
          {/* Dialogue ou feuille pour l'édition */}
          <UpdateFraisDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            frais={row.original} // Passerlesdonnéesactuellesdel'élèveonSuccess={() => row.toggleSelected(false)}
          />
          
          <DeleteFraissDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            Frais={[row.original]}
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
              {/* Ajout de l'option Edit */}
              <DropdownMenuItem onSelect={() => setShowUpdateTaskSheet(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowDeleteTaskDialog(true)}>
                Désactiver
                <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
