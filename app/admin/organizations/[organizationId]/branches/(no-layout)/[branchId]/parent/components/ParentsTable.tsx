import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IParent } from "@/src/interfaces/Parent";
import { getParentsAction } from "../parent.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";

const ParentsList = ({ refreshKey }: { refreshKey: number }) => {
  const [parents, setParents] = useState<IParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParents = async () => {
      try {
        setLoading(true);
        setError(null);

        const [rawParents, err] = await getParentsAction();

        if (err) {
          throw new Error(
            err.message || "Erreur lors du chargement des parents",
          );
        }

        setParents(rawParents);
      } catch (error: any) {
        console.error("Échec de récupérer les parents", error);
        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchParents();
  }, [refreshKey]); // 👈 IMPORTANT

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={5} columns={9} />
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

  if (!parents.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucun parent enregistré"
          description="Ajoutez votre premier parent pour commencer."
          icon={<IconUsers className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
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
  );
};

export default ParentsList;
