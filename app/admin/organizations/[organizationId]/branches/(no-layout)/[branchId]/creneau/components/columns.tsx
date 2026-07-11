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
import { DeleteCreneausDialog } from "./delete-Creneau-dialog";
import { UpdateCreneauDialog } from "./edit-Creneau-dialog";
import React from "react";
import { ICreneau } from "@/src/interfaces/creneau";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";

export const columns: ColumnDef<ICreneau>[] = [
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
    accessorKey: "nameCreneau",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom de la vacation" />
    ),
    cell: ({ row }) => {
      return row.original.nameCreneau;
    },
  },
  {
    accessorKey: "startTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Heure de debut" />
    ),
    cell: ({ row }) => {
      return row.original.startTime;
    },
  },

  {
    accessorKey: "endTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Heure de fin" />
    ),
    cell: ({ row }) => {
      return row.original.endTime;
    },
  },
  {
    accessorKey: "durationCourse",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Durée" />
    ),
    cell: ({ row }) => {
      return <span>{row.original.durationCourse} min</span>;
    },
  },
  {
    accessorKey: "recreationHour",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Récréation" />
    ),
    cell: ({ row }) => {
      return row.original.recreationHour;
    },
  },
  {
    accessorKey: "recreationDuration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Durée de la récré" />
    ),
    cell: ({ row }) => {
      return <span>{row.original.recreationDuration} min</span>;
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
          {/* Dialogue ou feuille pour leédition */}
          <UpdateCreneauDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            creneau={row.original} // PasserlesdonnéesactuellesdeleélèveonSuccess={() => row.toggleSelected(false)}
          />

          <DeleteCreneausDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            Creneaus={[row.original]}
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
              {/* Ajout de le creneau Edit */}
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
