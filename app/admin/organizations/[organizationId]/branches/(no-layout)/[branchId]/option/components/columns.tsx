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
import { DeleteOptionsDialog } from "./delete-Option-dialog";
import { UpdateOptionDialog } from "./edit-Option-dialog";
import React from "react";
import { IOption } from "@/src/interfaces/Option";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";

export const columns: ColumnDef<IOption>[] = [
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
    accessorKey: "codeOption",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code de l'option" />
    ),
    cell: ({ row }) => {
      return row.original.codeOption;
    },
  },
  {
    accessorKey: "nameOption",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom de l'option'" />
    ),
    cell: ({ row }) => {
      return row.original.nameOption;
    },
  },
  {
    accessorKey: "nameSection",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom de la section" />
    ),
    cell: ({ row }) => {
      return row.original?.codeSection;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ajoutée le " />
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
          <UpdateOptionDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            option={row.original} // Passerlesdonnéesactuellesdel'élèveonSuccess={() => row.toggleSelected(false)}
          />

          <DeleteOptionsDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            Options={[row.original]}
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
