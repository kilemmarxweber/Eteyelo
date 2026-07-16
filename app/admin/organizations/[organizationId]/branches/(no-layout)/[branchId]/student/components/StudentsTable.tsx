"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createStudentColumns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IStudent } from "@/src/interfaces/Student";
import { getStudentsAction } from "../student.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { UpdateStudentDialog } from "./edit-student-dialog";

const StudentsList = ({
  refreshKey,
  onRefresh,
  canManageStudents,
}: {
  refreshKey: number;
  onRefresh: () => void;
  canManageStudents: boolean;
}) => {
  const [students, setStudents] = useState<IStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<IStudent | null>(null);
  const hasLoadedOnce = useRef(false);
  const { refreshKey: contextRefreshKey } = useRefresh();

  const tableActions = useMemo(
    () => ({
      onEdit: (student: IStudent) => setEditingStudent(student),
    }),
    [],
  );

  const columns = useMemo(
    () => createStudentColumns(onRefresh, canManageStudents, tableActions),
    [canManageStudents, onRefresh, tableActions],
  );

  const fetchStudents = useCallback(async () => {
    const isInitialLoad = !hasLoadedOnce.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const [rawStudents, err] = await getStudentsAction();
      if (err) throw new Error(err.message);

      setStudents(rawStudents || []);
      hasLoadedOnce.current = true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur serveur");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents, refreshKey, contextRefreshKey]);

  const dialogs = (
    <>
      {editingStudent && canManageStudents ? (
        <UpdateStudentDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditingStudent(null);
          }}
          student={editingStudent}
          onSuccess={() => {
            setEditingStudent(null);
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
        <div className="p-4">
          <TableSkeleton rows={5} columns={8} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {dialogs}
        <div className="p-4">
          <Alert variant="destructive">
            <IconAlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (!students.length) {
    return (
      <>
        {dialogs}
        <div className="p-4">
          <EmptyTableState
            title="Aucun élève"
            description="Ajoutez un élève pour commencer"
            icon={<IconUsers />}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {dialogs}
      <div className="relative p-4">
        {isRefreshing ? (
          <div className="pointer-events-none absolute inset-x-4 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        ) : null}
        <ResponsiveDataTable
          columns={columns}
          ToolbarComponent={DataTableToolbar}
          data={students}
          emptyText="Aucun élève"
          mobileCardTitle={(row) => `${row.nom} ${row.postnom} ${row.prenom}`}
          mobileCardSubtitle={(row) => row.username ?? ""}
        />
      </div>
    </>
  );
};

export default StudentsList;
