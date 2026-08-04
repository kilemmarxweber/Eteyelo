"use client";

import React, { useEffect, useState } from "react";
import { IconAlertCircle, IconCalendar } from "@tabler/icons-react";

import {
  EmptyTableState,
  ResponsiveDataTable,
  TableSkeleton,
} from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";

import { getSchoolYearsAction } from "../schoolYear.action";
import { columns } from "./columns";
import { DataTableToolbar } from "./data-table-toolbar";

interface Props {
  branchId: string;
  refreshKey?: number;
}

function formatDateFr(value: Date | string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SchoolYearsList({ branchId, refreshKey = 0 }: Props) {
  const { labelLower } = useSchoolYearLabels();
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
          includeArchived: true,
        });

        if (err) {
          throw new Error(
            err.message || `Erreur lors du chargement des ${labelLower}s`,
          );
        }

        setSchoolYears(rawSchoolYears ?? []);
      } catch (err: unknown) {
        console.error("Échec de récupérer les années scolaires", err);
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue",
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchSchoolYears();
  }, [branchId, refreshKey, labelLower]);

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
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
      <div className="p-4 md:p-6">
        <EmptyTableState
          title={`Aucune ${labelLower}`}
          description={`Ajoutez votre première ${labelLower} pour commencer.`}
          icon={<IconCalendar className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <ResponsiveDataTable
        columns={columns}
        ToolbarComponent={DataTableToolbar}
        data={schoolYears}
        emptyText={`Aucune ${labelLower} ajoutée`}
        mobileCardTitle={(row) => row.nameYear}
        mobileCardSubtitle={(row) =>
          `${formatDateFr(row.startYear)} → ${formatDateFr(row.endYear)}`
        }
        mobileCardBadges={(row) => [
          {
            label: row.isCurrentYear ? "En cours" : "Inactive",
            variant: row.isCurrentYear ? "default" : "secondary",
          },
          ...((row as ISchoolYear & { isArchived?: boolean }).isArchived
            ? [{ label: "Clôturée", variant: "outline" as const }]
            : []),
        ]}
      />
    </div>
  );
}
