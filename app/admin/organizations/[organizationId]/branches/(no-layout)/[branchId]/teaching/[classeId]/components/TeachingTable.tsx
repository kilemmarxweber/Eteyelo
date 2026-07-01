import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import { ITeaching } from "@/src/interfaces/Teaching";
import { getTeachingByClassAction, getTeachings } from "../../teaching.action";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";

const TeachingsList = ({ params }: { params: { classeId: string } }) => {
  const [teachings, setTeachings] = useState<ITeaching[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeachings = async () => {
      try {
        setLoading(true);
        setError(null);

        if (params.classeId) {
          const [rawTeachings, err] = await getTeachingByClassAction({
            classeId: params.classeId,
          });
          if (err) {
            throw new Error(
              err.message || "Erreur lors du chargement des affectations",
            );
          }
          setTeachings(rawTeachings);
        } else {
          const [rawTeachings, err] = await getTeachings();
          if (err) {
            throw new Error(
              err.message || "Erreur lors du chargement des affectations",
            );
          }
          setTeachings(rawTeachings);
        }
      } catch (error: any) {
        console.error("Échec de récupérer les affectations", error);
        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchTeachings();
  }, [params.classeId]);

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={5} columns={8} />
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

  if (!teachings.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucun enseignant affecté"
          description="Aucun enseignant n'est actuellement affecté à cette classe."
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
        data={teachings}
        emptyText="Pas de professeur dans cette classe"
        mobileCardTitle={(row) =>
          `${row.nom ?? ""} ${row.postnom ?? ""} ${row.prenom ?? ""}`
        }
        mobileCardSubtitle={(row) => row.username ?? ""}
        mobileCardBadges={(row) =>
          [
            {
              label: row.sexe === "M" ? "Masculin" : "Féminin",
              variant: "secondary" as const,
            },
            {
              label: row.nameCours || "Cours non défini",
              variant: "outline" as const,
            },
            {
              label: row.nameYear || "Année non définie",
              variant: "outline" as const,
            },
          ].filter((b) => b.label)
        }
      />
    </div>
  );
};

export default TeachingsList;
