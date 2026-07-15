"use client";

import React, { useEffect, useMemo, useState } from "react";
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

const PersonnelsList = ({
  refreshKey,
  onRefresh,
  canManagePersonnel,
}: {
  refreshKey: number;
  onRefresh: () => void;
  canManagePersonnel: boolean;
}) => {
  const [personnels, setPersonnels] = useState<IPersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshKey: contextRefreshKey } = useRefresh();

  const columns = useMemo(
    () => createPersonnelColumns(onRefresh, canManagePersonnel),
    [canManagePersonnel, onRefresh],
  );

  const Toolbar = useMemo(
    () =>
      function PersonnelToolbar({ table }: { table: Table<IPersonnel> }) {
        return (
          <DataTableToolbar
            table={table}
            canManagePersonnel={canManagePersonnel}
          />
        );
      },
    [canManagePersonnel],
  );

  useEffect(() => {
    const fetchPersonnels = async () => {
      try {
        setLoading(true);
        setError(null);

        const [rawPersonnels, err] = await getPersonnelsAction();
        if (err) throw new Error(err.message);

        setPersonnels(rawPersonnels || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur serveur");
      } finally {
        setLoading(false);
      }
    };

    void fetchPersonnels();
  }, [refreshKey, contextRefreshKey]);

  if (loading) return <TableSkeleton rows={5} columns={8} />;

  if (error) {
    return (
      <Alert variant="destructive">
        <IconAlertCircle />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!personnels.length) {
    return (
      <EmptyTableState
        title="Aucun personnel enregistré"
        description="Ajoutez votre premier membre du personnel pour commencer."
        icon={<IconUsers />}
      />
    );
  }

  return (
    <div className="p-4">
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
  );
};

export default PersonnelsList;
