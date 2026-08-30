import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTeachingColumns } from "./columns";
import { ITeaching } from "@/src/interfaces/Teaching";
import { getTeachingByClassAction, getTeachings } from "../../teaching.action";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTableToolbar } from "./data-table-toolbar";
import { IconAlertCircle, IconUsers } from "@tabler/icons-react";

const TeachingsList = ({ params }: { params: { classeId: string } }) => {
  const t = useTranslations("teaching.assignments");
  const tt = useTranslations("teaching.assignments.table");
  const tc = useTranslations("common");
  const columns = useTeachingColumns();
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
            throw new Error(err.message || t("loadFailed"));
          }
          setTeachings(rawTeachings);
        } else {
          const [rawTeachings, err] = await getTeachings();
          if (err) {
            throw new Error(err.message || t("loadFailed"));
          }
          setTeachings(rawTeachings);
        }
      } catch (error: any) {
        console.error("Failed to fetch assignments", error);
        setError(error.message || t("loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    fetchTeachings();
  }, [params.classeId, t]);

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
            {error}. {tt("loadRetry")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!teachings.length) {
    return (
      <div className="p-6">
        <EmptyTableState
          title={t("noTeacherAssigned")}
          description={t("noTeacherAssignedDesc")}
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
        emptyText={tt("emptyText")}
        mobileCardTitle={(row) =>
          `${row.nom ?? ""} ${row.postnom ?? ""} ${row.prenom ?? ""}`
        }
        mobileCardSubtitle={(row) => row.username ?? ""}
        mobileCardBadges={(row) =>
          [
            {
              label:
                row.sexe === "M" ? tc("person.male") : tc("person.female"),
              variant: "secondary" as const,
            },
            {
              label: row.nameCours || t("courseUndefined"),
              variant: "outline" as const,
            },
            {
              label: row.nameYear || t("yearUndefined"),
              variant: "outline" as const,
            },
          ].filter((b) => b.label)
        }
      />
    </div>
  );
};

export default TeachingsList;
