"use client";

import React from "react";
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
import { StudentListPhotoCell } from "./student-list-photo-cell";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export type StudentTableActions = {
  onEdit: (student: IStudent) => void;
};

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
  actions?: StudentTableActions,
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
      const fullName = [student.nom, student.postnom, student.prenom]
        .filter(Boolean)
        .join(" ");

      return (
        <StudentListPhotoCell
          image={student.image}
          nom={student.nom}
          prenom={student.prenom}
          fullName={fullName}
        />
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
      <span className="font-semibold text-foreground">
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
      <span className="text-foreground/80">{row.original.postnom ?? "N/A"}</span>
    ),
  },
  {
    accessorKey: "prenom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prénom" />
    ),
    cell: ({ row }) => (
      <span className="text-foreground/80">{row.original.prenom ?? "N/A"}</span>
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
    id: "schoolYearId",
    accessorKey: "schoolYearId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Annee" />
    ),
    cell: ({ row }) => row.original.schoolYearName ?? "—",
    filterFn: (row, _id, value) => {
      const selected = Array.isArray(value) ? value.map(String) : [];
      if (!selected.length) return true;
      const yearIds = row.original.enrollmentYearIds ?? [];
      if (!yearIds.length) {
        const fallback = row.original.schoolYearId;
        return fallback ? selected.includes(fallback) : false;
      }
      return selected.some((yearId) => yearIds.includes(yearId));
    },
    enableHiding: true,
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
    cell: ({ row, table }) => {
      const yearFilter = table.getColumn("schoolYearId")?.getFilterValue();
      const selectedYears = Array.isArray(yearFilter)
        ? yearFilter.map(String)
        : [];
      const enrollment =
        selectedYears.length === 1
          ? row.original.enrollments?.find(
              (item) => item.schoolYearId === selectedYears[0],
            )
          : null;
      const classCode =
        enrollment?.classCode ?? row.original.classCode ?? null;

      return (
        <span className="font-medium text-primary">
          {classCode || "Non inscrit"}
        </span>
      );
    },
    filterFn: (row, id, value) => {
      if (!Array.isArray(value) || !value.length) return true;
      const classCodes = new Set<string>();
      const current = row.getValue(id);
      if (typeof current === "string" && current) classCodes.add(current);
      for (const enrollment of row.original.enrollments ?? []) {
        if (enrollment.classCode) classCodes.add(enrollment.classCode);
      }
      return value.some((code) => classCodes.has(String(code)));
    },
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
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);

      const params = useParams<{ organizationId: string; branchId: string }>();

      const handleSuccess = () => {
        row.toggleSelected(false);
        onRefresh?.();
      };

      return (
        <>
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
                organizationId={params.organizationId}
                showTrigger={false}
                onSuccess={handleSuccess}
              />
            </>
          ) : null}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0 text-foreground hover:bg-blue-50 data-[state=open]:bg-blue-50"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                Détails
              </DropdownMenuItem>

              {canManageStudents ? (
                <>
                  <DropdownMenuItem
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
