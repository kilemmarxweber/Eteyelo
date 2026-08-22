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
import { E13E80Dialog } from "./e13-e80-dialog";
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
  canPurgePermanently = false,
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
    id: "registeredPeriod",
    accessorFn: (student) => student.createdAt,
    header: () => null,
    cell: () => null,
    filterFn: (row, _id, value) => {
      const selected = Array.isArray(value)
        ? value.map(String).filter(Boolean)
        : typeof value === "string" && value
          ? [value]
          : [];
      const period = selected[0];
      if (!period || period === "all") return true;

      const startOfLocalDay = (date: Date) =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate());

      const getRange = () => {
        const now = new Date();
        const end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );

        if (period === "today") {
          return { start: startOfLocalDay(now), end };
        }

        if (period === "week") {
          const day = now.getDay();
          const mondayOffset = day === 0 ? -6 : 1 - day;
          const monday = startOfLocalDay(now);
          monday.setDate(monday.getDate() + mondayOffset);
          return { start: monday, end };
        }

        if (period === "month") {
          return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end,
          };
        }

        return null;
      };

      const range = getRange();
      if (!range) return true;

      const isInRange = (date: Date | string | null | undefined) => {
        if (!date) return false;
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= range.start && d <= range.end;
      };

      const student = row.original;
      if (isInRange(student.createdAt)) return true;
      return (student.enrollments ?? []).some((enrollment) =>
        isInRange(enrollment.createdAt),
      );
    },
    enableHiding: true,
    enableSorting: false,
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
      <DataTableColumnHeader column={column} title="Classe" />
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
      const classLabel =
        enrollment?.className ??
        enrollment?.classCode ??
        row.original.className ??
        row.original.classCode ??
        null;

      return (
        <span className="font-medium text-primary">
          {classLabel || "Non inscrit"}
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
    id: "e13",
    accessorFn: (student) => student.e13 ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E13" />
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
      const value = enrollment?.e13 ?? row.original.e13;
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {value || "—"}
        </span>
      );
    },
    enableHiding: true,
  },
  {
    id: "e80",
    accessorFn: (student) => student.e80 ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E80" />
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
      const value = enrollment?.e80 ?? row.original.e80;
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {value || "—"}
        </span>
      );
    },
    enableHiding: true,
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showPurgeTaskDialog, setShowPurgeTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);
      const [showE13E80Dialog, setShowE13E80Dialog] = React.useState(false);

      const params = useParams<{ organizationId: string; branchId: string }>();
      const isArchived = row.original.statusUser === false;

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
              <E13E80Dialog
                open={showE13E80Dialog}
                onOpenChange={setShowE13E80Dialog}
                student={row.original}
                onSuccess={handleSuccess}
              />
              <DeleteStudentsDialog
                open={showDeleteTaskDialog}
                onOpenChange={setShowDeleteTaskDialog}
                students={[row.original]}
                showTrigger={false}
                onSuccess={handleSuccess}
              />
              {canPurgePermanently ? (
                <DeleteStudentsDialog
                  open={showPurgeTaskDialog}
                  onOpenChange={setShowPurgeTaskDialog}
                  students={[row.original]}
                  showTrigger={false}
                  permanent
                  onSuccess={handleSuccess}
                />
              ) : null}

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
                    onSelect={(event) => {
                      event.preventDefault();
                      openOverlayAfterMenuDismiss(() =>
                        setShowE13E80Dialog(true),
                      );
                    }}
                  >
                    E13 &amp; E80
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    Réinitialiser
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {!isArchived ? (
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => setShowDeleteTaskDialog(true)}
                    >
                      Archiver
                      <DropdownMenuShortcut>Del</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}

                  {canPurgePermanently ? (
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => setShowPurgeTaskDialog(true)}
                    >
                      Supprimer
                      <DropdownMenuShortcut>⇧Del</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}
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
