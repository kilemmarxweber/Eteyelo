"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";

import {
  EmptyTableState,
  ResponsiveDataTable,
  TableSkeleton,
} from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { useRefresh } from "@/src/hooks/RefreshContext";

import { createPersonnelColumns } from "./columns";
import { DataTableToolbar } from "./data-table-toolbar";
import { getPersonnelsAction } from "../personnel.action";
import { UpdatePersonnelDialog } from "./edit-personnel-dialog";

const PersonnelsList = ({
  refreshKey,
  onRefresh,
  canManagePersonnel,
  supportsStaffImport = false,
  onOpenImport,
}: {
  refreshKey: number;
  onRefresh: () => void;
  canManagePersonnel: boolean;
  supportsStaffImport?: boolean;
  onOpenImport?: () => void;
}) => {
  const [personnels, setPersonnels] = useState<IPersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPersonnel, setEditingPersonnel] = useState<IPersonnel | null>(
    null,
  );
  const hasLoadedOnce = useRef(false);
  const { refreshKey: contextRefreshKey } = useRefresh();

  const tableActions = useMemo(
    () => ({
      onEdit: (personnel: IPersonnel) => setEditingPersonnel(personnel),
    }),
    [],
  );

  const columns = useMemo(
    () =>
      createPersonnelColumns(onRefresh, canManagePersonnel, tableActions),
    [canManagePersonnel, onRefresh, tableActions],
  );

  const Toolbar = useMemo(
    () =>
      function PersonnelToolbar({ table }: { table: Table<IPersonnel> }) {
        return (
          <DataTableToolbar
            table={table}
            canManagePersonnel={canManagePersonnel}
            supportsStaffImport={supportsStaffImport}
            onOpenImport={onOpenImport}
          />
        );
      },
    [canManagePersonnel, onOpenImport, supportsStaffImport],
  );

  const fetchPersonnels = useCallback(async () => {
    const isInitialLoad = !hasLoadedOnce.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const [rawPersonnels, err] = await getPersonnelsAction();
      if (err) throw new Error(err.message);

      setPersonnels(rawPersonnels || []);
      hasLoadedOnce.current = true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur serveur");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchPersonnels();
  }, [fetchPersonnels, refreshKey, contextRefreshKey]);

  const dialogs = (
    <>
      {editingPersonnel && canManagePersonnel ? (
        <UpdatePersonnelDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditingPersonnel(null);
          }}
          personnel={editingPersonnel}
          onSuccess={() => {
            setEditingPersonnel(null);
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
        <Alert variant="destructive">
          <IconAlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </>
    );
  }

  if (!personnels.length) {
    return (
      <>
        {dialogs}
        <EmptyTableState
          title="Aucun personnel enregistré"
          description={
            supportsStaffImport
              ? "Creez ou importez un personnel depuis une autre branche pour commencer."
              : "Ajoutez votre premier membre du personnel pour commencer."
          }
          icon={<IconUsers />}
          actionLabel={
            supportsStaffImport && canManagePersonnel
              ? "Importer un personnel"
              : undefined
          }
          onAction={
            supportsStaffImport && canManagePersonnel ? onOpenImport : undefined
          }
        />
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
          ToolbarComponent={Toolbar}
          data={personnels}
          emptyText="Aucun personnel"
          mobileCardTitle={(row) =>
            [row.nom, row.postnom, row.prenom].filter(Boolean).join(" ")
          }
          mobileCardSubtitle={(row) => row.username ?? "—"}
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
            ].filter((badge) => badge.label)
          }
        />
      </div>
    </>
  );
};

export default PersonnelsList;
