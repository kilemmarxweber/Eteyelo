"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const { refreshKey: contextRefreshKey } = useRefresh();
  const columns = useMemo(
    () => createStudentColumns(onRefresh, canManageStudents),
    [canManageStudents, onRefresh],
  );

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        setError(null);

        const [rawStudents, err] = await getStudentsAction();

        if (err) throw new Error(err.message);

        setStudents(rawStudents || []);
      } catch (e: any) {
        setError(e.message || "Erreur serveur");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [refreshKey, contextRefreshKey]);

  if (loading) return <TableSkeleton rows={5} columns={8} />;

  if (error)
    return (
      <Alert variant="destructive">
        <IconAlertCircle />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );

  if (!students.length)
    return (
      <EmptyTableState
        title="Aucun élève"
        description="Ajoutez un élève pour commencer"
        icon={<IconUsers />}
      />
    );

  return (
    <div className="p-4">
      <ResponsiveDataTable
        columns={columns}
        ToolbarComponent={DataTableToolbar}
        data={students}
        emptyText="Aucun élève"
        mobileCardTitle={(row) => `${row.nom} ${row.postnom} ${row.prenom}`}
        mobileCardSubtitle={(row) => row.username ?? ""}
      />
    </div>
  );
};

export default StudentsList;
