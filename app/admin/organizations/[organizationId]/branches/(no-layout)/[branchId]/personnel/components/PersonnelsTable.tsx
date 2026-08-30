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

import { usePersonnelColumns } from "./columns";
import { DataTableToolbar } from "./data-table-toolbar";
import { getPersonnelsAction } from "../personnel.action";
import { UpdatePersonnelDialog } from "./edit-personnel-dialog";
import { sortActiveStatusUserFirst } from "@/lib/archive";
import { useTranslations } from "next-intl";

const PersonnelsList = ({
  refreshKey,
  onRefresh,
  canManagePersonnel,
  canPurgePermanently = false,
  supportsStaffImport = false,
  onOpenImport,
}: {
  refreshKey: number;
  onRefresh: () => void;
  canManagePersonnel: boolean;
  canPurgePermanently?: boolean;
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
  const t = useTranslations("users.staff.table");
  const tStaff = useTranslations("users.staff");
  const tPerson = useTranslations("common.person");
  const tCommon = useTranslations("common");

  const tableActions = useMemo(
    () => ({
      onEdit: (personnel: IPersonnel) => setEditingPersonnel(personnel),
    }),
    [],
  );

  const columns = usePersonnelColumns(
    onRefresh,
    canManagePersonnel,
    tableActions,
    canPurgePermanently,
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

      setPersonnels(sortActiveStatusUserFirst(rawPersonnels || []));
      hasLoadedOnce.current = true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tCommon("errorGeneric"));
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
          title={t("emptyTitle")}
          description={
            supportsStaffImport ? t("emptyImportDesc") : t("emptyAddDesc")
          }
          icon={<IconUsers />}
          actionLabel={
            supportsStaffImport && canManagePersonnel
              ? tStaff("importOne")
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
          emptyText={t("noResults")}
          mobileCardTitle={(row) =>
            [row.nom, row.postnom, row.prenom].filter(Boolean).join(" ")
          }
          mobileCardSubtitle={(row) => row.username ?? "—"}
          mobileCardBadges={(row) =>
            [
              {
                label:
                  row.sexe === "M" ? tPerson("male") : tPerson("female"),
                variant: "secondary" as const,
              },
              {
                label: row.telephone || tPerson("phone"),
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
