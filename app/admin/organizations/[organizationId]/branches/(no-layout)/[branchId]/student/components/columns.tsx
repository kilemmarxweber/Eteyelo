"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IStudent } from "@/src/interfaces/Student";
import { DeleteStudentsDialog } from "./delete-students-dialog";
import { DetailsStudentDialog } from "./details-student-dialog";
import { ResetUsersDialog } from "./reset-users-dialog";
import { UpdateStudentDialog } from "./edit-student-dialog";

export const createStudentColumns = (
  onRefresh?: () => void,
  canManageStudents = true,
): ColumnDef<IStudent>[] => [
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
    cell: ({ row }) => row.original.nom ?? "N/A",
    filterFn: (row, id, value) => {
      const search = String(value).toLowerCase().trim();
      const nom = String(row.getValue(id) ?? "").toLowerCase();
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
    cell: ({ row }) => row.original.postnom ?? "N/A",
  },
  {
    accessorKey: "prenom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prenom" />
    ),
    cell: ({ row }) => row.original.prenom ?? "N/A",
  },
  {
    accessorKey: "sexe",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sexe" />
    ),
    cell: ({ row }) => row.original.sexe ?? "N/A",
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "dateOfBirth",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date naissance" />
    ),
    cell: (row) =>
      row.getValue()
        ? new Date(row.getValue() as string).toLocaleDateString()
        : "N/A",
  },
  {
    accessorKey: "parentNom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom du parent" />
    ),
    cell: ({ row }) => row.original.parent?.nom ?? "N/A",
  },
  {
    accessorKey: "telephone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Telephone" />
    ),
    cell: ({ row }) => (
      <Link
        className="text-primary underline-offset-4 hover:underline"
        href={`tel:${row.original.parent?.telephone ?? ""}`}
      >
        {row.original.parent?.telephone ?? "N/A"}
      </Link>
    ),
  },
  {
    accessorKey: "createdAt",
    cell: (row) =>
      row.getValue()
        ? new Date(row.getValue() as string).toLocaleDateString()
        : "N/A",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created at" />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);
      const params = useParams<{ organizationId: string; branchId: string }>();
      const studentHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/student/${row.original.id}`;

      const handleSuccess = () => {
        row.toggleSelected(false);
        onRefresh?.();
      };

      return (
        <>
          {canManageStudents ? (
            <UpdateStudentDialog
              open={showUpdateTaskSheet}
              onOpenChange={setShowUpdateTaskSheet}
              student={row.original}
              onSuccess={handleSuccess}
            />
          ) : null}
          <DetailsStudentDialog
            open={showDetailsTaskDialog}
            onOpenChange={setShowDetailsTaskDialog}
            student={row.original}
          />
          {canManageStudents ? (
            <>
              <DeleteStudentsDialog
                open={showDeleteTaskDialog}
                onOpenChange={setShowDeleteTaskDialog}
                students={[row.original]}
                showTrigger={false}
                onSuccess={handleSuccess}
              />
              <ResetUsersDialog
                open={showResetTaskDialog}
                onOpenChange={setShowResetTaskDialog}
                email={row.original.email || ""}
                showTrigger={false}
                onSuccess={handleSuccess}
              />
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0 data-[state=open]:bg-muted"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={studentHref}>Voir</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                Details
              </DropdownMenuItem>
              {canManageStudents ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => setShowUpdateTaskSheet(true)}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    Reinitialiser
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setShowDeleteTaskDialog(true)}
                  >
                    Delete
                    <DropdownMenuShortcut>Del</DropdownMenuShortcut>
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

export const columns = createStudentColumns();
