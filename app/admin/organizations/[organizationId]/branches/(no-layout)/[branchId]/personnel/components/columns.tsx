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
import { UpdatePersonnelDialog } from "./edit-personnel-dialog";
import { DetailsPersonnelDialog } from "./details-personnel-dialog";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { ResetUsersDialog } from "../../student/components/reset-users-dialog";
import { DeletePersonalDialog } from "./delete-personal-dialog";
import { AddPersonnelRole } from "./add-personnelrole-dialog";
import { data } from "autoprefixer";

export const columns: ColumnDef<IPersonnel>[] = [
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
    accessorKey: "nom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom" />
    ),
    cell: ({ row }) => {
      return row.original.nom ?? "N/A";
    },
    filterFn: (row, id, value) => {
      const search = String(value).toLowerCase().trim();
      const nom = String(row.getValue("nom") ?? "").toLowerCase();
      const postnom = String(row.getValue("postnom") ?? "").toLowerCase();
      const prenom = String(row.getValue("prenom") ?? "").toLowerCase();

      return (
        nom.includes(search) ||
        postnom.includes(search) ||
        prenom.includes(search)
      );
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
      return row.original.sexe ?? "N/A";
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "dateOfBirth",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dateofbirth" />
    ),
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: "telephone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Telephone" />
    ),
    cell: ({ row }) => {
      return (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`tel:${row.original.telephone}`}
        >
          {row.original.telephone ?? "N/A"}
        </Link>
      );
    },
  },
  {
    accessorKey: "Email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),
    cell: ({ row }) => {
      return (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`tel:${row.original.email}`}
        >
          {row.original.email ?? "N/A"}
        </Link>
      );
    },
  },
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Createdat" />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showPersonnalRoleSheet, setShowPersonnalRoleSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);

      const personnel = row.original;
      return (
        <>
          <UpdatePersonnelDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            personnel={personnel}
          />
          <AddPersonnelRole
            open={showPersonnalRoleSheet}
            onOpenChange={setShowPersonnalRoleSheet}
            personnel={personnel}
          />

          <DetailsPersonnelDialog
            open={showDetailsTaskDialog}
            onOpenChange={setShowDetailsTaskDialog}
            personnel={personnel}
          />

          <DeletePersonalDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            personals={[personnel]}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />

          <ResetUsersDialog
            open={showResetTaskDialog}
            onOpenChange={setShowResetTaskDialog}
            email={personnel.email || ""}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex size-8 p-0">
                <IconDots className="size-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                Details
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={() => setShowUpdateTaskSheet(true)}>
                Edit
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => {
                  setShowPersonnalRoleSheet(true);
                }}
              >
                Affecter un rôle
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={() => setShowResetTaskDialog(true)}>
                Réinitialiser
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
