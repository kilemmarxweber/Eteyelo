"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createParentColumns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IParent } from "@/src/interfaces/Parent";
import { getParentsAction } from "../parent.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { UpdateParentDialog } from "./edit-parent-dialog";

const ParentsList = ({ refreshKey }: { refreshKey: number }) => {
  const [parents, setParents] = useState<IParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingParent, setEditingParent] = useState<IParent | null>(null);
  const hasLoadedOnce = useRef(false);
  const { refreshKey: contextRefreshKey } = useRefresh();

  const tableActions = useMemo(
    () => ({
      onEdit: (parent: IParent) => setEditingParent(parent),
    }),
    [],
  );

  const columns = useMemo(
    () => createParentColumns(tableActions),
    [tableActions],
  );

  const fetchParents = useCallback(async () => {
    const isInitialLoad = !hasLoadedOnce.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const [rawParents, err] = await getParentsAction();
      if (err) {
        throw new Error(err.message || "Erreur lors du chargement des parents");
      }

      setParents(rawParents);
      hasLoadedOnce.current = true;
    } catch (fetchError: unknown) {
      console.error("Échec de récupérer les parents", fetchError);
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
    void fetchParents();
  }, [fetchParents, refreshKey, contextRefreshKey]);

  const dialogs = (
    <>
      {editingParent ? (
        <UpdateParentDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditingParent(null);
          }}
          parent={editingParent}
          onSuccess={() => setEditingParent(null)}
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

  if (!parents.length) {
    return (
      <>
        {dialogs}
        <div className="p-6">
          <EmptyTableState
            title="Aucun parent enregistré"
            description="Ajoutez votre premier parent pour commencer."
            icon={<IconUsers className="h-10 w-10 text-muted-foreground" />}
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
          ToolbarComponent={DataTableToolbar}
          data={parents}
          emptyText="Aucun tuteur ajouté"
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
            ].filter((b) => b.label)
          }
        />
      </div>
    </>
  );
};

export default ParentsList;
