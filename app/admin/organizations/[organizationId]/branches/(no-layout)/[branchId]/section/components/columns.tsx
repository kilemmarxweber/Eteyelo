"use client";

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
import { DeleteSectionsDialog } from "./delete-Section-dialog";
import { UpdateSectionDialog } from "./edit-Section-dialog";
import React from "react";
import { ISection } from "@/src/interfaces/Section";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";

export const columns: ColumnDef<ISection>[] = [
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
  /* 
header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Identifiant" />
    ),
 */
  {
    accessorKey: "codeSection",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code de la section" />
    ),
    cell: ({ row }) => {
      return row.original.codeSection;
    },
  },
  {
    accessorKey: "nameSection",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom de la section" />
    ),
    cell: ({ row }) => {
      return row.original.nameSection;
    },
  },
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ajouté le" />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);

      return (
        <>
          {/* Dialogue ou feuille pour l'édition */}
          <UpdateSectionDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            section={row.original} // Passerlesdonnéesactuellesdel'élèveonSuccess={() => row.toggleSelected(false)}
          />

          <DeleteSectionsDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            Sections={[row.original]}
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
