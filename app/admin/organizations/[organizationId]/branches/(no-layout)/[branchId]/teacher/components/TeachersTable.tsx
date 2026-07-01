import React, { useEffect, useMemo, useState } from "react";
import { createTeacherColumns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ITeacher } from "@/src/interfaces/Teacher";
import { getTeachersAction } from "../teacher.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";

const TeachersList = ({
  refreshKey,
  onRefresh,
  canManageTeachers,
}: {
  refreshKey: number;
  onRefresh: () => void;
  canManageTeachers: boolean;
}) => {
  const [teachers, setTeachers] = useState<ITeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const columns = useMemo(
    () => createTeacherColumns(onRefresh, canManageTeachers),
    [canManageTeachers, onRefresh],
  );

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rawTeachers, err] = await getTeachersAction();
        if (err) {
          throw new Error(
            err.message || "Erreur lors du chargement des enseignants",
          );
        }

        setTeachers(rawTeachers);
      } catch (error: any) {
        console.error("Échec de récupérer les enseignants", error);
        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();
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

  if (!teachers.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucun enseignant enregistré"
          description="Ajoutez votre premier enseignant pour commencer."
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
        data={teachers}
        emptyText="Aucun enseignant Ajouté"
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

export default TeachersList;
