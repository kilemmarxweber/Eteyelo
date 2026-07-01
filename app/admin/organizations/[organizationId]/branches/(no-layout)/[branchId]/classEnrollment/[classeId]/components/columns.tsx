"use client";

import { ColumnDef } from "@tanstack/react-table";
import { IconArrowUp,IconDots  } from "@tabler/icons-react";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UpdateStudentDialog } from "./edit-Enrollment-dialog";
import { DeleteClassEnrollmentsDialog } from "./delete-Enrollment-dialog"

import React from "react";
import {
  IclassEnrollment
} from "@/src/interfaces/classEnrollment";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";

export const columns: ColumnDef<IclassEnrollment>[] = [
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
    accessorKey: "username",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Identifiant" />
    ),
    cell: ({ row }) => {
      return row.original.username ?? "N/A";
    },
  },
  {
    accessorKey: "nom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom" />
    ),
    cell: ({ row }) => {
      return row.original.nom ?? "N/A";
    },
  },
  {
    accessorKey: "postnom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Postnom" />
    ),
    cell: ({ row }) => {
      return row.original.postnom ?? "N/A";
    },
  },
  {
    accessorKey: "prenom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prenom" />
    ),
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
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "dateOfBirth",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Naissance " />
    ),
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: "nameYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Année scolaire" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex items-center">
          <span>{row.original.nameYear}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
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
      const [isUpdatePending, startUpdateTransition] = React.useTransition();
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);

      return (
        <>
          {/* Dialogue ou feuille pour l'édition */}
          <UpdateStudentDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            classEnrollment={row.original} // Passerlesdonnéesactuellesdel'élèveonSuccess={() => row.toggleSelected(false)}
          />

          <DeleteClassEnrollmentsDialog 
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            enrollments={[row.original]}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />

          {/* 
          <UpdateStudentDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            users={[row.original]}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />
 */}
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
                Delete
                <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
