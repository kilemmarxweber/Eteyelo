"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

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
import {
  getStudentExamCodesActionState,
  studentAllowsExamCodes,
} from "@/lib/exam-export-meta";

export type StudentTableActions = {
  onEdit: (student: IStudent) => void;
};

export type StudentExamCodesColumnContext = {
  typebranch?: unknown;
  educationSystem?: unknown;
  showExamCodeColumns?: boolean;
};

function selectedSchoolYearIds(table: {
  getColumn: (id: string) => { getFilterValue: () => unknown } | undefined;
}): string[] {
  const yearFilter = table.getColumn("schoolYearId")?.getFilterValue();
  return Array.isArray(yearFilter) ? yearFilter.map(String) : [];
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

export function useStudentColumns(
  onRefresh?: () => void,
  canManageStudents = true,
  actions?: StudentTableActions,
  canPurgePermanently = false,
  examCodes?: StudentExamCodesColumnContext,
): ColumnDef<IStudent>[] {
  const t = useTranslations("users.students.table");
  const tCommon = useTranslations("common");
  const tPerson = useTranslations("common.person");
  const tDashboard = useTranslations("dashboard");
  const tProfile = useTranslations("users.teachers.profile");
  const locale = useLocale();

  return useMemo(() => {
  const columns: ColumnDef<IStudent>[] = [

  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label={tCommon("selectAll")}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={tCommon("selectRow")}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "photo",
    header: t("photo"),
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
      <DataTableColumnHeader column={column} title={tPerson("lastName")} />
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
      <DataTableColumnHeader column={column} title={tPerson("postnom")} />
    ),
    cell: ({ row }) => (
      <span className="text-foreground/80">{row.original.postnom ?? "N/A"}</span>
    ),
  },
  {
    accessorKey: "prenom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={tPerson("firstName")} />
    ),
    cell: ({ row }) => (
      <span className="text-foreground/80">{row.original.prenom ?? "N/A"}</span>
    ),
  },
  {
    accessorKey: "sexe",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={tPerson("gender")} />
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
      <DataTableColumnHeader column={column} title={t("schoolYear")} />
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
      <DataTableColumnHeader column={column} title={t("birthDate")} />
    ),
    cell: (row) =>
      row.getValue()
        ? new Date(row.getValue() as string).toLocaleDateString(locale)
        : "N/A",
  },
  {
    accessorKey: "classCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("class")} />
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
          {classLabel || tDashboard("notEnrolled")}
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
      <DataTableColumnHeader column={column} title={t("age")} />
    ),
    accessorFn: (student) => calculateAge(student.dateOfBirth),
    cell: ({ row }) => {
      const age = calculateAge(row.original.dateOfBirth);
      return age === null
        ? "N/A"
        : `${age} ${age > 1 ? tProfile("yearPlural") : tProfile("yearSingular")}`;
    },
  },
  {
    id: "e13",
    accessorFn: (student) => student.e13 ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E13" />
    ),
    cell: ({ row, table }) => {
      const selectedYears = selectedSchoolYearIds(table);
      const allowed = studentAllowsExamCodes(row.original, {
        typebranch: examCodes?.typebranch,
        educationSystem: examCodes?.educationSystem,
        schoolYearIds: selectedYears,
      });
      if (!allowed) {
        return (
          <span className="font-mono text-xs text-muted-foreground">—</span>
        );
      }
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
      const selectedYears = selectedSchoolYearIds(table);
      const allowed = studentAllowsExamCodes(row.original, {
        typebranch: examCodes?.typebranch,
        educationSystem: examCodes?.educationSystem,
        schoolYearIds: selectedYears,
      });
      if (!allowed) {
        return (
          <span className="font-mono text-xs text-muted-foreground">—</span>
        );
      }
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
    cell: function Cell({ row, table }) {
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
      const examCodesState = getStudentExamCodesActionState(row.original, {
        typebranch: examCodes?.typebranch,
        educationSystem: examCodes?.educationSystem,
        schoolYearIds: selectedSchoolYearIds(table),
      });
      const examCodesEnabled = examCodesState === "enabled";

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
              {examCodesEnabled ? (
                <E13E80Dialog
                  open={showE13E80Dialog}
                  onOpenChange={setShowE13E80Dialog}
                  student={row.original}
                  onSuccess={handleSuccess}
                />
              ) : null}
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
                aria-label={tCommon("openMenu")}
                variant="ghost"
                className="flex size-8 p-0 text-foreground hover:bg-blue-50 data-[state=open]:bg-blue-50"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                {t("details")}
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
                    {t("edit")}
                  </DropdownMenuItem>

                  {examCodesState !== "hidden" ? (
                    <DropdownMenuItem
                      disabled={!examCodesEnabled}
                      onSelect={(event) => {
                        event.preventDefault();
                        if (!examCodesEnabled) return;
                        openOverlayAfterMenuDismiss(() =>
                          setShowE13E80Dialog(true),
                        );
                      }}
                    >
                      E13 &amp; E80
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    {tCommon("reset")}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {!isArchived ? (
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => setShowDeleteTaskDialog(true)}
                    >
                      {tCommon("archive")}
                      <DropdownMenuShortcut>Del</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}

                  {canPurgePermanently ? (
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => setShowPurgeTaskDialog(true)}
                    >
                      {tCommon("delete")}
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
  return columns.filter((column) => {
    if (column.id === "e13" || column.id === "e80") {
      return examCodes?.showExamCodeColumns !== false;
    }
    return true;
  });
  }, [
    t,
    tCommon,
    tPerson,
    tDashboard,
    tProfile,
    locale,
    onRefresh,
    canManageStudents,
    actions,
    canPurgePermanently,
    examCodes,
  ]);
}

/** @deprecated Use useStudentColumns() hook instead */
export const columns: ColumnDef<IStudent>[] = [];
