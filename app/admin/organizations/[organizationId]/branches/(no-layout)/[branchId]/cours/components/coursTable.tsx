import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCoursColumns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ICours } from "@/src/interfaces/Cours";
import { getCoursAction } from "../cours.action";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconBook } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";

const CoursList = ({
  refreshKey = 0,
  isPrimary = false,
}: {
  refreshKey?: number;
  isPrimary?: boolean;
}) => {
  const t = useTranslations("teaching.courses.table");
  const tc = useTranslations("common");
  const [cours, setCours] = useState<ICours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshKey: contextRefreshKey } = useRefresh();
  const columns = useCoursColumns(isPrimary);

  useEffect(() => {
    const fetchCours = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rawCours, err] = await getCoursAction({ includeInactive: true });
        if (err) {
          throw new Error(err.message || t("loadFailed"));
        }
        setCours(rawCours);
      } catch (error: any) {
        console.error(error);
        setError(error.message || tc("errorGeneric"));
      } finally {
        setLoading(false);
      }
    };

    fetchCours();
  }, [refreshKey, contextRefreshKey]);

  if (loading) {
    return (
      <div className="p-4">
        <TableSkeleton rows={5} columns={isPrimary ? 6 : 5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}. {t("loadRetry")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!cours.length) {
    return (
      <div className="p-4">
        <EmptyTableState
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          icon={<IconBook className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="relative p-4">
      <ResponsiveDataTable
        ToolbarComponent={DataTableToolbar}
        columns={columns}
        data={cours}
        emptyText={t("emptyTitle")}
        mobileCardTitle={(row) => row.nameCours}
      />
    </div>
  );
};

export default CoursList;
