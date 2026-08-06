"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { IconCalendar, IconDots, IconEdit, IconArchive } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";

import { DeleteSchoolYearsDialog } from "./delete-SchoolYear-dialog";
import { UpdateSchoolYearDialog } from "./edit-SchoolYear-dialog";
import { CurrentYear } from "./currentYear";

function formatDateFr(value: Date | string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type SchoolYearRow = ISchoolYear & {
  isArchived?: boolean;
  createdAt?: Date | string;
};

export const columns: ColumnDef<SchoolYearRow>[] = [
  {
    accessorKey: "nameYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Année" />
    ),
    filterFn: (row, id, value) => {
      const query = String(value ?? "")
        .trim()
        .toLowerCase();
      if (!query) return true;
      const name = String(row.getValue(id) ?? "").toLowerCase();
      return name.includes(query);
    },
    cell: ({ row }) => {
      const year = row.original;
      return (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{year.nameYear}</span>
            {year.isCurrentYear ? (
              <Badge variant="default" size="xs">
                En cours
              </Badge>
            ) : null}
            {year.isArchived ? (
              <Badge variant="outline" size="xs">
                Clôturée
              </Badge>
            ) : null}
          </div>
          {year.createdAt ? (
            <span className="text-xs text-muted-foreground">
              Ajoutée le {formatDateFr(year.createdAt)}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "period",
    accessorKey: "startYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Période" />
    ),
    cell: ({ row }) => {
      const { startYear, endYear } = row.original;
      return (
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <IconCalendar className="size-3.5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-medium">
              {formatDateFr(startYear)}
              <span className="mx-1 text-muted-foreground">→</span>
              {formatDateFr(endYear)}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(startYear).getFullYear()} –{" "}
              {new Date(endYear).getFullYear()}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "isCurrentYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Année courante" />
    ),
    cell: ({ row }) => {
      const year = row.original;
      return (
        <div className="flex items-center gap-2">
          <CurrentYear
            id={year.id}
            nameYear={year.nameYear}
            startYear={year.startYear}
            endYear={year.endYear}
            isCurrentYear={year.isCurrentYear}
            branchId={year.branchId}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {year.isCurrentYear ? "Active" : "Inactive"}
          </span>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showUpdateSheet, setShowUpdateSheet] = React.useState(false);
      const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
      const year = row.original;

      return (
        <>
          <UpdateSchoolYearDialog
            open={showUpdateSheet}
            onOpenChange={setShowUpdateSheet}
            schoolYear={year}
            branchId={year.branchId}
            onSuccess={() => {
              row.toggleSelected(false);
              setShowUpdateSheet(false);
            }}
          />

          <DeleteSchoolYearsDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            SchoolYears={[year]}
            showTrigger={false}
            onSuccess={() => {
              row.toggleSelected(false);
              setShowDeleteDialog(false);
            }}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Ouvrir le menu"
                variant="ghost"
                className="flex size-8 p-0 data-[state=open]:bg-muted"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setShowUpdateSheet(true)}>
                <IconEdit className="mr-2 size-4" />
                Modifier
              </DropdownMenuItem>
              {!year.isArchived ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setShowDeleteDialog(true)}>
                    <IconArchive className="mr-2 size-4" />
                    Clôturer
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
