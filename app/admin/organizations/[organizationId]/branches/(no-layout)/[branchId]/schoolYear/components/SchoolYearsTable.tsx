"use client";

import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { getSchoolYearsAction } from "../schoolYear.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconCalendar } from "@tabler/icons-react";

interface Props {
  branchId: string;
}

export default function SchoolYearsList({ branchId }: Props) {
  const [schoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;

    const fetchSchoolYears = async () => {
      try {
        setLoading(true);
        setError(null);

        const [rawSchoolYears, err] = await getSchoolYearsAction({
          branchId,
        });

        if (err) {
          throw new Error(
            err.message || "Erreur lors du chargement des années scolaires",
          );
        }

        setSchoolYears(rawSchoolYears ?? []);
      } catch (error: any) {
        console.error("Échec de récupérer les années scolaires", error);

        setError(error.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolYears();
  }, [branchId]);

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

  if (!schoolYears.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title="Aucune année scolaire"
          description="Ajoutez votre première année scolaire pour commencer."
          icon={<IconCalendar className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <ResponsiveDataTable
        columns={columns}
        ToolbarComponent={DataTableToolbar}
        data={schoolYears}
        emptyText="Aucune année scolaire ajoutée"
        mobileCardTitle={(row) => row.nameYear}
        mobileCardSubtitle={(row) =>
          `${new Date(row.startYear).getFullYear()} - ${new Date(
            row.endYear,
          ).getFullYear()}`
        }
        mobileCardBadges={(row) => [
          {
            label: row.isCurrentYear ? "Année en cours" : "Année passée",
            variant: row.isCurrentYear ? "default" : "secondary",
          },
        ]}
      />
    </div>
  );
}
