"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClasseColumns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IClasse } from "@/src/interfaces/Classe";
import {
  getBranchTypeAction,
  getClassesAction,
} from "../classe.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconSchool } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { isPrimaryBranch } from "@/lib/class-structure";
import { ManagedBranchType } from "@/lib/academic-structure";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { UpdateClasseDialog } from "./edit-Classe-dialog";
import { DeleteClassesDialog } from "./delete-Classe-dialog";

type ClasseStats = {
  total: number;
  active: number;
  inactive: number;
};

const ClassesList = ({
  refreshKey = 0,
  onStats,
}: {
  refreshKey?: number;
  onStats?: (stats: ClasseStats) => void;
}) => {
  const [classes, setClasses] = useState<IClasse[]>([]);
  const [branchType, setBranchType] = useState<ManagedBranchType>("SECONDAIRE");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingClasse, setEditingClasse] = useState<IClasse | null>(null);
  const [archivingClasse, setArchivingClasse] = useState<IClasse | null>(null);
  const [deletingClasse, setDeletingClasse] = useState<IClasse | null>(null);
  const hasLoadedOnce = useRef(false);
  const { refreshKey: contextRefreshKey } = useRefresh();
  const { data: session } = useSession();
  const canManage = canManageOrganization(session);

  const showOption = !isPrimaryBranch(branchType);

  const tableActions = useMemo(
    () => ({
      onEdit: (classe: IClasse) => setEditingClasse(classe),
      onArchive: (classe: IClasse) => setArchivingClasse(classe),
      onDelete: (classe: IClasse) => setDeletingClasse(classe),
    }),
    [],
  );

  const columns = useMemo(
    () => getClasseColumns(showOption, tableActions, canManage),
    [showOption, tableActions, canManage],
  );

  const fetchClasses = useCallback(async () => {
    const isInitialLoad = !hasLoadedOnce.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const [[rawClasses, classesErr], [branchResult, branchErr]] =
        await Promise.all([getClassesAction(), getBranchTypeAction()]);

      if (classesErr) {
        throw new Error(classesErr.message || "Erreur lors du chargement des classes");
      }
      if (branchErr) {
        throw new Error(branchErr.message || "Erreur lors du chargement de la branche");
      }

      setClasses(rawClasses);
      setBranchType(branchResult.typebranch as ManagedBranchType);
      hasLoadedOnce.current = true;
      const active = rawClasses.filter((item) => item.statusClasse !== false).length;
      onStats?.({
        total: rawClasses.length,
        active,
        inactive: rawClasses.length - active,
      });
    } catch (fetchError: unknown) {
      console.error("Echec de recuperer les classes", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Une erreur est survenue",
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [onStats]);

  useEffect(() => {
    void fetchClasses();
  }, [fetchClasses, refreshKey, contextRefreshKey]);

  const dialogs = (
    <>
      {editingClasse ? (
        <UpdateClasseDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditingClasse(null);
          }}
          classe={editingClasse}
        />
      ) : null}

      {archivingClasse ? (
        <DeleteClassesDialog
          open
          onOpenChange={(open) => {
            if (!open) setArchivingClasse(null);
          }}
          Classes={[archivingClasse]}
          showTrigger={false}
          onSuccess={() => setArchivingClasse(null)}
        />
      ) : null}

      {deletingClasse ? (
        <DeleteClassesDialog
          open
          permanent
          onOpenChange={(open) => {
            if (!open) setDeletingClasse(null);
          }}
          Classes={[deletingClasse]}
          showTrigger={false}
          onSuccess={() => setDeletingClasse(null)}
        />
      ) : null}
    </>
  );

  if (loading) {
    return (
      <>
        {dialogs}
        <div className="p-6">
          <TableSkeleton rows={5} columns={6} />
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
              {error}. Veuillez reessayer plus tard.
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (!classes.length) {
    return (
      <>
        {dialogs}
        <div className="p-6">
          <EmptyTableState
            title="Aucune classe enregistree"
            description="Creez votre premiere classe pour commencer la gestion academique."
            icon={<IconSchool className="h-10 w-10 text-muted-foreground" />}
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
          ToolbarComponent={(props) => (
            <DataTableToolbar {...props} showOptionFilter={showOption} />
          )}
          columns={columns}
          data={classes}
          emptyText="Aucune classe enregistree"
          mobileCardTitle={(row) => row.nameClasse}
          mobileCardSubtitle={(row) => {
            const parts = [row.level, row.parallel].filter(Boolean);
            return parts.length ? parts.join(" ") : `Code: ${row.codeClasse}`;
          }}
          mobileCardBadges={(row) => [
            ...(showOption
              ? [
                  {
                    label: row.option?.nameOption || "Aucune option",
                    variant: "secondary" as const,
                  },
                ]
              : []),
            {
              label: row.creneau?.nameCreneau || "Aucune vacation",
              variant: "outline" as const,
            },
          ]}
        />
      </div>
    </>
  );
};

export default ClassesList;
