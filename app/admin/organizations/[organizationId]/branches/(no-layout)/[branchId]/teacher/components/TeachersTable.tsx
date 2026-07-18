"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { createTeacherColumns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ITeacher } from "@/src/interfaces/Teacher";
import { getTeachersAction } from "../teacher.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { UpdateTeacherDialog } from "./edit-teacher-dialog";

type TeacherAssignmentFilter =
  | "all"
  | "active"
  | "assigned"
  | "unassigned";

const TeachersList = ({
  refreshKey,
  onRefresh,
  canManageTeachers,
  assignmentFilter,
  supportsStaffImport = false,
  onOpenImport,
}: {
  refreshKey: number;
  onRefresh: () => void;
  canManageTeachers: boolean;
  assignmentFilter: TeacherAssignmentFilter;
  supportsStaffImport?: boolean;
  onOpenImport?: () => void;
}) => {
  const [teachers, setTeachers] = useState<ITeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<ITeacher | null>(null);
  const hasLoadedOnce = useRef(false);
  const { refreshKey: contextRefreshKey } = useRefresh();

  const tableActions = useMemo(
    () => ({
      onEdit: (teacher: ITeacher) => setEditingTeacher(teacher),
    }),
    [],
  );

  const columns = useMemo(
    () => createTeacherColumns(onRefresh, canManageTeachers, tableActions),
    [canManageTeachers, onRefresh, tableActions],
  );

  const TeacherToolbar = useMemo(() => {
    function Toolbar(props: { table: Table<ITeacher> }) {
      return (
        <DataTableToolbar
          {...props}
          canManageTeachers={canManageTeachers}
          supportsStaffImport={supportsStaffImport}
          onOpenImport={onOpenImport}
        />
      );
    }

    return Toolbar;
  }, [canManageTeachers, onOpenImport, supportsStaffImport]);

  const displayedTeachers = useMemo(
    () =>
      teachers.filter((teacher) => {
        if (assignmentFilter === "active") return teacher.statusUser !== false;
        if (assignmentFilter === "assigned") {
          return (
            teacher.statusUser !== false &&
            teacher.assignmentStatus === "assigned"
          );
        }
        if (assignmentFilter === "unassigned") {
          return (
            teacher.statusUser !== false &&
            teacher.assignmentStatus === "unassigned"
          );
        }
        return true;
      }),
    [assignmentFilter, teachers],
  );

  const fetchTeachers = useCallback(async () => {
    const isInitialLoad = !hasLoadedOnce.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const [rawTeachers, err] = await getTeachersAction();
      if (err) {
        throw new Error(
          err.message || "Erreur lors du chargement des enseignants",
        );
      }

      setTeachers(rawTeachers);
      hasLoadedOnce.current = true;
    } catch (fetchError: unknown) {
      console.error("Échec de récupérer les enseignants", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Une erreur est survenue",
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers, refreshKey, contextRefreshKey]);

  const dialogs = (
    <>
      {editingTeacher && canManageTeachers ? (
        <UpdateTeacherDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditingTeacher(null);
          }}
          teacher={editingTeacher}
          onSuccess={() => {
            setEditingTeacher(null);
            onRefresh();
          }}
        />
      ) : null}
    </>
  );

  if (loading) {
    return (
      <>
        {dialogs}
        <div className="p-6">
          <TableSkeleton rows={5} columns={9} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {dialogs}
        <div className="p-6">
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}. Veuillez réessayer plus tard.
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (!teachers.length) {
    return (
      <>
        {dialogs}
        <div className="p-6">
          <EmptyTableState
            title="Aucun enseignant enregistré"
            description={
              supportsStaffImport
                ? "Creez ou importez un enseignant depuis une autre branche pour commencer."
                : "Ajoutez votre premier enseignant pour commencer."
            }
            icon={<IconUsers className="h-10 w-10 text-muted-foreground" />}
            actionLabel={
              supportsStaffImport && canManageTeachers
                ? "Importer un enseignant"
                : undefined
            }
            onAction={
              supportsStaffImport && canManageTeachers ? onOpenImport : undefined
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      {dialogs}
      <div className="relative p-6">
        {isRefreshing ? (
          <div className="pointer-events-none absolute inset-x-6 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        ) : null}
        <ResponsiveDataTable
          columns={columns}
          ToolbarComponent={TeacherToolbar}
          data={displayedTeachers}
          emptyText="Aucun enseignant Ajouté"
          mobileCardTitle={(row) => `${row.nom} ${row.postnom} ${row.prenom}`}
          mobileCardSubtitle={(row) => row.username ?? ""}
          mobileCardBadges={(row) =>
            [
              {
                label: row.sexe === "M" ? "Masculin" : "Féminin",
                variant: "secondary" as const,
              },
              {
                label: row.telephone || "Téléphone non défini",
                variant: "outline" as const,
              },
              {
                label:
                  row.assignmentStatus === "assigned"
                    ? `${row.assignmentCount ?? 0} affectation(s)`
                    : "Non affecte",
                variant:
                  row.assignmentStatus === "assigned"
                    ? ("default" as const)
                    : ("destructive" as const),
              },
            ].filter((b) => b.label)
          }
        />
      </div>
    </>
  );
};

export default TeachersList;
