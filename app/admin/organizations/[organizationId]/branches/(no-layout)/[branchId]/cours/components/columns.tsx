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
import { DeleteCoursDialog } from "./delete-Cours-dialog";
import { UpdateCoursDialog } from "./edit-Cours-dialog";
import React from "react";
import { ICours } from "@/src/interfaces/Cours";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";

export const columns: ColumnDef<ICours>[] = [
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
    accessorKey: "codeCours",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="codeCours" />
    ),
    cell: ({ row }) => {
      return row.original.nameCours;
    },
  },
  {
    accessorKey: "nameCours",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom du cours" />
    ),
    cell: ({ row }) => {
      return row.original.nameCours;
    },
  },
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date d'ajout" />
    ),
  },
  {
    accessorKey: "ponderation",
    cell: ({ row }) => {
      return row.original.ponderation;
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ponderation" />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const { data: session } = useSession();
      const canManageCours = canManageOrganization(session);
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);

      return (
        <>
          {/* Dialogue ou feuille pour l'édition */}
          <UpdateCoursDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            cours={row.original} // Passerlesdonnéesactuellesdel'élèveonSuccess={() => row.toggleSelected(false)}
          />

          <DeleteCoursDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            Cours={[row.original]}
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
              {canManageCours && (
                <DropdownMenuItem onSelect={() => setShowUpdateTaskSheet(true)}>
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {canManageCours && (
                <DropdownMenuItem
                  onSelect={() => setShowDeleteTaskDialog(true)}
                >
                  Delete
                  <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
