"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Table } from "@tanstack/react-table";
import { createStudentColumns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IStudent } from "@/src/interfaces/Student";
import { getStudentsAction } from "../student.action";
import { getStudentPageContextAction } from "../../brevets/brevet.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { ImportStudentDialog } from "./import-student-dialog";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { UpdateStudentDialog } from "./edit-student-dialog";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { getClassDisplayLabel, isSchoolBranch } from "@/lib/branch-capabilities";

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
  const [requiresImport, setRequiresImport] = useState(false);
  const [supportsImport, setSupportsImport] = useState(false);
  const [importScope, setImportScope] = useState<"school_only" | "organization">(
    "school_only",
  );
  const [importEnrollmentMode, setImportEnrollmentMode] = useState<
    "university" | "centre" | null
  >(null);
  const peopleLabels = useBranchPeopleLabels();
  const [classLabel, setClassLabel] = useState("Classe");
  const [importOpen, setImportOpen] = useState(false);
  const hasLoadedOnce = useRef(false);
  const { refreshKey: contextRefreshKey } = useRefresh();
  const router = useRouter();
  const params = useParams<{ organizationId: string; branchId: string }>();

  const handleStudentRowClick = useCallback(
    (student: IStudent) => {
      router.push(
        `/admin/organizations/${params.organizationId}/branches/${params.branchId}/student/${student.id}`,
      );
    },
    [params.branchId, params.organizationId, router],
  );

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

  const StudentToolbar = useMemo(() => {
    function Toolbar(props: { table: Table<IStudent> }) {
      return (
        <DataTableToolbar
          {...props}
          canManageStudents={canManageStudents}
          requiresImport={requiresImport}
          supportsImport={supportsImport}
          importScope={importScope}
          peopleLabels={peopleLabels}
          classLabel={classLabel}
          onOpenImport={() => setImportOpen(true)}
        />
      );
    }

    return Toolbar;
  }, [canManageStudents, classLabel, importScope, peopleLabels, requiresImport, supportsImport]);

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

  useEffect(() => {
    void getStudentPageContextAction().then((context) => {
      setRequiresImport(Boolean(context.requiresImport));
      setSupportsImport(Boolean(context.supportsImport));
      setImportScope(context.importScope ?? "school_only");
      setImportEnrollmentMode(context.importEnrollmentMode ?? null);
      if (context.typebranch && !isSchoolBranch(context.typebranch)) {
        setClassLabel(getClassDisplayLabel(context.typebranch));
      }
    });
  }, [refreshKey, contextRefreshKey]);

  const dialogs = (
    <>
      <ImportStudentDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importScope={importScope}
        importEnrollmentMode={importEnrollmentMode}
        peopleLabels={peopleLabels}
        onSuccess={onRefresh}
      />
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
        <div className="space-y-4 p-4">
          {requiresImport ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <AlertDescription>
                Les eleves d&apos;atelier doivent etre importes depuis une
                branche scolaire (primaire ou secondaire) de l&apos;organisation.
              </AlertDescription>
            </Alert>
          ) : supportsImport ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <AlertDescription>
                Vous pouvez creer des {peopleLabels.studentPluralLower} directement
                ou les importer depuis une autre branche de l&apos;organisation.
              </AlertDescription>
            </Alert>
          ) : null}
          <EmptyTableState
            title={`Aucun ${peopleLabels.studentLower}`}
            description={
              requiresImport
                ? "Importez un eleve scolaire pour commencer"
                : supportsImport
                  ? `Creez ou importez un ${peopleLabels.studentLower} pour commencer`
                  : `Ajoutez un ${peopleLabels.studentLower} pour commencer`
            }
            icon={<IconUsers />}
            actionLabel={
              (requiresImport || supportsImport) && canManageStudents
                ? requiresImport
                  ? "Importer un eleve"
                  : `Importer un ${peopleLabels.studentLower}`
                : undefined
            }
            onAction={
              (requiresImport || supportsImport) && canManageStudents
                ? () => setImportOpen(true)
                : undefined
            }
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
          ToolbarComponent={StudentToolbar}
          data={students}
          emptyText={`Aucun ${peopleLabels.studentLower}`}
          mobileCardTitle={(row) => `${row.nom} ${row.postnom} ${row.prenom}`}
          mobileCardSubtitle={(row) => row.username ?? ""}
          onRowClick={handleStudentRowClick}
        />
      </div>
    </>
  );
};

export default StudentsList;
