import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { getPersonnelsAction } from "../personnel.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";

const PersonnelsList = ({ refreshKey }: { refreshKey: number }) => {
  const [personnels, setPersonnels] = useState<IPersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPersonnels = async () => {
    try {
      setLoading(true);
      setError(null);

      const [rawPersonnels, err] = await getPersonnelsAction();

      if (err) throw new Error(err.message);

      setPersonnels(rawPersonnels);
    } catch (error: any) {
      setError(error.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnels();
  }, [refreshKey]);

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

  if (!personnels.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucun personnel enregistré"
          description="Ajoutez votre premier membre du personnel pour commencer."
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
        data={personnels}
        emptyText="Aucun personnel Ajouté"
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
          ].filter((b) => b.label)
        }
      />
    </div>
  );
};

export default PersonnelsList;
