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
import Image from "next/image";

function getStudentImage(student: IStudent): string | undefined {
  const image = student.image || undefined;

  if (!image || typeof image !== "string") return undefined;

  if (
    image.startsWith("http") ||
    image.startsWith("data:") ||
    image.startsWith("/")
  ) {
    return image;
  }

  return `/uploads/${image}`;
}

function calculateAge(dateOfBirth: Date | string | null | undefined) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayNotReached =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (birthdayNotReached) age -= 1;
  return age >= 0 ? age : null;
}

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
    id: "photo",
    header: "PHOTO",
    cell: ({ row }) => {
      const student = row.original;
      const image = getStudentImage(student);

      const fullName = [student.nom, student.postnom, student.prenom]
        .filter(Boolean)
        .join(" ");

      const initials =
        `${student.nom?.[0] ?? ""}${student.prenom?.[0] ?? ""}`.toUpperCase() ||
        "EL";

      return (
        <div className="flex items-center justify-center">
          <div className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-blue-50 ring-2 ring-white">
            {image ? (
              <Image
                src={image}
                alt={fullName || "Élève"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-black text-blue-700">
                {initials}
              </span>
            )}
          </div>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "nom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom" />
    ),
    cell: ({ row }) => (
      <span className="font-semibold text-blue-950">
        {row.original.nom ?? "N/A"}
      </span>
    ),
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
    cell: ({ row }) => (
      <span className="text-blue-950/80">{row.original.postnom ?? "N/A"}</span>
    ),
  },
  {
    accessorKey: "prenom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prénom" />
    ),
    cell: ({ row }) => (
      <span className="text-blue-950/80">{row.original.prenom ?? "N/A"}</span>
    ),
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
    accessorKey: "classCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code classe" />
    ),
    cell: ({ row }) => (
      <span className="font-medium text-blue-700">
        {row.original.classCode || "Non inscrit"}
      </span>
    ),
    filterFn: (row, id, value) =>
      Array.isArray(value) ? value.includes(row.getValue(id)) : true,
  },
  {
    id: "age",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Âge" />
    ),
    accessorFn: (student) => calculateAge(student.dateOfBirth),
    cell: ({ row }) => {
      const age = calculateAge(row.original.dateOfBirth);
      return age === null ? "N/A" : `${age} an${age > 1 ? "s" : ""}`;
    },
  },
  {
    accessorKey: "placeOfBirth",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lieu de naissance" />
    ),
    cell: ({ row }) => row.original.placeOfBirth || "N/A",
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
                className="flex size-8 p-0 text-blue-950 hover:bg-blue-50 data-[state=open]:bg-blue-50"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={studentHref}>Voir</Link>
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                Détails
              </DropdownMenuItem>

              {canManageStudents ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => setShowUpdateTaskSheet(true)}
                  >
                    Modifier
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    Réinitialiser
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={() => setShowDeleteTaskDialog(true)}
                  >
                    Archiver
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
