"use client";

import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IclassEnrollment } from "@/src/interfaces/classEnrollment";
import {
  getClassEnrollmentByClassAction,
  getClassEnrolements,
} from "../../classEnrollment.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

const ClassEnrollmentsList = ({ params }: { params: { classeId: string } }) => {
  const peopleLabels = useBranchPeopleLabels();
  const [classEnrollments, setClassEnrollments] = useState<IclassEnrollment[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClassEnrollments = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(params.classeId);

        if (params.classeId) {
          const [rawClassEnrollments, err] =
            await getClassEnrollmentByClassAction({
              classeId: params.classeId,
            });
          if (err) {
            throw new Error(
              err.message || "Erreur lors du chargement des inscriptions",
            );
          }
          setClassEnrollments(rawClassEnrollments);
        } else {
          const [rawClassEnrollments, err] = await getClassEnrolements();
          if (err) {
            throw new Error(
              err.message || "Erreur lors du chargement des inscriptions",
            );
          }
          setClassEnrollments(rawClassEnrollments);
        }
      } catch (error: any) {
        console.error("Échec de récupérer les inscriptions", error);
        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchClassEnrollments();
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

  if (!classEnrollments.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title={peopleLabels.noneEnrolledTitle}
          description={peopleLabels.noneEnrolledDescription}
          icon={<IconUsers className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <ResponsiveDataTable
        columns={columns}
        data={classEnrollments}
        ToolbarComponent={DataTableToolbar}
        emptyText="Pas d'inscrits dans cette classe"
        mobileCardTitle={(row) => `${row.nom} ${row.postnom} ${row.prenom}`}
        mobileCardSubtitle={(row) => row.username ?? ""}
        mobileCardBadges={(row) =>
          [
            {
              label: row.sexe === "M" ? "Masculin" : "Féminin",
              variant: "secondary",
            } as const,
            {
              label: row.nameYear || "Année non définie",
              variant: "outline",
            } as const,
          ].filter((b) => b.label)
        }
      />
    </div>
  );
};

export default ClassEnrollmentsList;
