"use client";

import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";
import { IClasse } from "@/src/interfaces/Classe";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export type ClasseTableActions = {
  onEdit: (classe: IClasse) => void;
  onArchive: (classe: IClasse) => void;
};

export function getClasseColumns(
  showOption = true,
  actions?: ClasseTableActions,
): ColumnDef<IClasse>[] {
  const columns: ColumnDef<IClasse>[] = [
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
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => row.original.codeClasse,
    },
    {
      accessorKey: "nameClasse",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nom de la classe" />
      ),
      cell: ({ row }) => row.original.nameClasse,
    },
    {
      accessorKey: "level",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Niveau" />
      ),
      cell: ({ row }) => row.original.level ?? "-",
    },
    {
      accessorKey: "parallel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parallele" />
      ),
      cell: ({ row }) => row.original.parallel ?? "-",
    },
  ];

  if (showOption) {
    columns.push({
      accessorKey: "nameOption",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Option" />
      ),
      cell: ({ row }) => row.original.option?.nameOption ?? "-",
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    });
  }

  columns.push(
    {
      accessorKey: "nameCreneau",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vacation" />
      ),
      cell: ({ row }) => row.original.creneau?.nameCreneau ?? "-",
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "capacity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Capacite" />
      ),
      cell: ({ row }) => row.original.capacity ?? "-",
    },
    {
      accessorKey: "createdAt",
      cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cree le" />
      ),
    },
    {
      id: "actions",
      cell: function Cell({ row }) {
        const { data: session } = useSession();
        const canManageClasse = canManageOrganization(session);

        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                aria-label="Open menu"
                variant="ghost"
                size="icon"
                className="size-8"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                disabled={!canManageClasse || !actions}
                onSelect={(event) => {
                  event.preventDefault();
                  if (!actions) return;
                  openOverlayAfterMenuDismiss(() => actions.onEdit(row.original));
                }}
              >
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!canManageClasse || !actions}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  if (!actions) return;
                  openOverlayAfterMenuDismiss(() =>
                    actions.onArchive(row.original),
                  );
                }}
              >
                Archiver
                <DropdownMenuShortcut className="text-destructive">
                  ⌘⌫
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  );

  return columns;
}

export const columns = getClasseColumns(true);
