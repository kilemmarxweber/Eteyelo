import React, { useEffect, useMemo, useState } from "react";
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

const ClassesList = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [classes, setClasses] = useState<IClasse[]>([]);
  const [branchType, setBranchType] = useState<ManagedBranchType>("SECONDAIRE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshKey: contextRefreshKey } = useRefresh();

  const showOption = !isPrimaryBranch(branchType);
  const columns = useMemo(() => getClasseColumns(showOption), [showOption]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
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
      } catch (error: any) {
        console.error("Echec de recuperer les classes", error);
        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [refreshKey, contextRefreshKey]);

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
            {error}. Veuillez reessayer plus tard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!classes.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucune classe enregistree"
          description="Creez votre premiere classe pour commencer la gestion academique."
          icon={<IconSchool className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
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
            ? [{ label: row.option?.nameOption || "Aucune option", variant: "secondary" as const }]
            : []),
          { label: row.creneau?.nameCreneau || "Aucune vacation", variant: "outline" as const },
        ]}
      />
    </div>
  );
};

export default ClassesList;
