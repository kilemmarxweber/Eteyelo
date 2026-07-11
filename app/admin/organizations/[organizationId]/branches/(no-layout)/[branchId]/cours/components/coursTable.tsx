import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ICours } from "@/src/interfaces/Cours";
import { getCoursAction } from "../cours.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconBook } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";

const CoursList = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [cours, setCours] = useState<ICours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshKey: contextRefreshKey } = useRefresh();

  useEffect(() => {
    const fetchCours = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rawCours, err] = await getCoursAction({ includeInactive: true });
        if (err) {
          throw new Error(err.message || "Erreur lors du chargement des cours");
        }
        setCours(rawCours);
      } catch (error: any) {
        console.error("Échec de récupérer des cours", error);
        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchCours();
  }, [refreshKey, contextRefreshKey]);

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={5} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}. Veuillez réessayer plus tard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!cours.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucun cours enregistré"
          description="Créez votre premier cours pour commencer la gestion académique."
          icon={<IconBook className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <ResponsiveDataTable
        ToolbarComponent={DataTableToolbar}
        columns={columns}
        data={cours}
        emptyText="Aucun cours enregistré"
        mobileCardTitle={(row) => row.nameCours}
        mobileCardSubtitle={(row) => `Code: ${row.codeCours}`}
        mobileCardBadges={(row) => [
          { label: row.description || "Sans description", variant: "secondary" },
        ]}
      />
    </div>
  );
};

export default CoursList;
