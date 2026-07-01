import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IClasse } from "@/src/interfaces/Classe";
import { getClassesAction } from "../classe.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconSchool } from "@tabler/icons-react";

const ClassesList = () => {
  const [classes, setClasses] = useState<IClasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rawClasses, err] = await getClassesAction();
        if (err) {
          throw new Error(err.message || "Erreur lors du chargement des classes");
        }
        setClasses(rawClasses);
      } catch (error: any) {
        console.error("Échec de récupérer les classes", error);
        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={5} columns={6} />
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

  if (!classes.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucune classe enregistrée"
          description="Créez votre première classe pour commencer la gestion académique."
          icon={<IconSchool className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <ResponsiveDataTable
        ToolbarComponent={DataTableToolbar}
        columns={columns}
        data={classes}
        emptyText="Aucune classe enregistrée"
        mobileCardTitle={(row) => row.nameClasse}
        mobileCardSubtitle={(row) => `Code: ${row.codeClasse}`}
        mobileCardBadges={(row) => [
          { label: row.option?.nameOption || 'Aucune option', variant: 'secondary' },
          { label: row.creneau?.nameCreneau || 'Aucune vacation', variant: 'outline' }
        ]}
      />
    </div>
  );
};

export default ClassesList;
