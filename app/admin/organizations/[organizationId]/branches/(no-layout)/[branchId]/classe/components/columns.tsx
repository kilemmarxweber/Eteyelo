"use client";

import { ColumnDef } from "@tanstack/react-table";
import { IconDots, IconSchool } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";
import { IClasse } from "@/src/interfaces/Classe";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";
import { cycleLabel } from "@/lib/cycle";

export type ClasseTableActions = {
  onEdit: (classe: IClasse) => void;
  onArchive: (classe: IClasse) => void;
};

export function getClasseColumns(
  showOption = true,
  actions?: ClasseTableActions,
  canManage = false,
): ColumnDef<IClasse>[] {
  const columns: ColumnDef<IClasse>[] = [
    {
      accessorKey: "nameClasse",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Classe" />
      ),
      cell: ({ row }) => {
        const classe = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconSchool className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{classe.nameClasse}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" size="xs">
                  {classe.codeClasse}
                </Badge>
                {classe.cycle ? (
                  <Badge variant="outline" size="xs">
                    {cycleLabel(classe.cycle)}
                  </Badge>
                ) : null}
                {classe.createdAt ? (
                  <span className="text-xs text-muted-foreground">
                    {new Date(classe.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "level",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Niveau" />
      ),
      cell: ({ row }) => {
        const { level, parallel } = row.original;
        return (
          <div className="leading-tight">
            <div className="text-sm font-medium">{level ?? "—"}</div>
            {parallel ? (
              <div className="text-xs text-muted-foreground">
                Parallèle {parallel}
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  if (showOption) {
    columns.push({
      accessorKey: "nameOption",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Option" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.option?.nameOption ?? "—"}
        </span>
      ),
      filterFn: (row, _id, value) => {
        const name = row.original.option?.nameOption ?? "";
        return Array.isArray(value) ? value.includes(name) : true;
      },
    });
  }

  columns.push(
    {
      accessorKey: "nameCreneau",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vacation" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.creneau?.nameCreneau ?? "—"}
        </span>
      ),
      filterFn: (row, _id, value) => {
        const name = row.original.creneau?.nameCreneau ?? "";
        return Array.isArray(value) ? value.includes(name) : true;
      },
    },
    {
      accessorKey: "capacity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Capacité" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.capacity ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label="Ouvrir le menu"
              variant="ghost"
              size="icon"
              className="size-8"
            >
              <IconDots className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              disabled={!canManage || !actions}
              onSelect={(event) => {
                event.preventDefault();
                if (!actions) return;
                openOverlayAfterMenuDismiss(() =>
                  actions.onEdit(row.original),
                );
              }}
            >
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canManage || !actions}
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
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  );

  return columns;
}

export const columns = getClasseColumns(true);
