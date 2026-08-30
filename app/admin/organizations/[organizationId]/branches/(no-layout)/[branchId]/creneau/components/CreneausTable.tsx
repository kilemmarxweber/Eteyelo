"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Coffee, Edit, Archive, MoreHorizontal, Clock, Trash2 } from "lucide-react";

import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  matchesIsArchivedFilter,
  type ActiveArchiveFilter,
} from "@/lib/archive";
import { previewPeriodsAroundRecreation } from "@/src/hooks/getCourseHours";
import { ICreneau } from "@/src/interfaces/creneau";

import { getCreneauxAction } from "../creneau.action";
import { DeleteCreneausDialog } from "./delete-Creneau-dialog";
import { UpdateCreneauDialog } from "./edit-Creneau-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

interface CreneausTableProps {
  refreshKey?: string;
}

function PeriodBadge({
  creneau,
  sessionsLabel,
}: {
  creneau: ICreneau;
  sessionsLabel: (count: number) => string;
}) {
  const preview = previewPeriodsAroundRecreation(
    creneau.startTime,
    creneau.endTime,
    creneau.durationCourse,
    creneau.recreationHour,
    creneau.recreationDuration,
  );

  if (!preview) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" size="xs">
        {preview.before} + {preview.after}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {sessionsLabel(preview.total)}
      </span>
    </div>
  );
}

const CreneausTable: React.FC<CreneausTableProps> = ({ refreshKey }) => {
  const t = useTranslations("teaching.vacation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [creneaux, setCreneaus] = useState<ICreneau[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ActiveArchiveFilter>("active");

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCreneau, setSelectedCreneau] = useState<ICreneau | null>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  useEffect(() => {
    const fetchCreneaus = async () => {
      try {
        setLoading(true);
        const [rawCreneaus, err] = await getCreneauxAction({
          includeArchived: true,
        });
        if (err) {
          throw new Error("Failed to fetch creneaux");
        }
        setCreneaus(rawCreneaus);
      } catch (error) {
        console.error("Échec de récupérer les créneaux", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCreneaus();
  }, [refreshKey, localRefreshKey]);

  const filteredCreneaux = creneaux.filter((creneau) => {
    const matchesSearch =
      creneau.nameCreneau.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creneau.startTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creneau.endTime.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesArchive = matchesIsArchivedFilter(
      creneau.isArchived,
      statusFilter,
    );

    return matchesSearch && matchesArchive;
  });

  const handleEdit = (creneau: ICreneau) => {
    setSelectedCreneau(creneau);
    openOverlayAfterMenuDismiss(() => setShowUpdateDialog(true));
  };

  const handleArchive = (creneau: ICreneau) => {
    setSelectedCreneau(creneau);
    openOverlayAfterMenuDismiss(() => setShowArchiveDialog(true));
  };

  const handleDelete = (creneau: ICreneau) => {
    setSelectedCreneau(creneau);
    openOverlayAfterMenuDismiss(() => setShowDeleteDialog(true));
  };

  const handleActionSuccess = () => {
    setShowUpdateDialog(false);
    setShowArchiveDialog(false);
    setShowDeleteDialog(false);
    setSelectedCreneau(null);
    setLocalRefreshKey((value) => value + 1);
  };

  const columns = useMemo(
    () => [
    {
      key: "nameCreneau",
      header: t("columnName"),
      cell: (creneau: ICreneau) => (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{creneau.nameCreneau}</span>
            {creneau.isArchived ? (
              <Badge variant="outline" size="xs">
                {t("archived")}
              </Badge>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">
            {t("createdOn", {
              date: new Date(creneau.createdAt).toLocaleDateString(locale),
            })}
          </span>
        </div>
      ),
    },
    {
      key: "schedule",
      header: t("columnSchedule"),
      cell: (creneau: ICreneau) => (
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Clock className="size-3.5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-medium tabular-nums">
              {creneau.startTime}
              <span className="mx-1 text-muted-foreground">–</span>
              {creneau.endTime}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("sessionDuration", { minutes: creneau.durationCourse })}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "recreation",
      header: t("columnRecreation"),
      cell: (creneau: ICreneau) => (
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Coffee className="size-3.5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-medium tabular-nums">
              {creneau.recreationHour || "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {creneau.recreationDuration} min
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "periods",
      header: t("columnSessions"),
      cell: (creneau: ICreneau) => (
        <PeriodBadge
          creneau={creneau}
          sessionsLabel={(count) => t("sessionsCount", { count })}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (creneau: ICreneau) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{tc("actions")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleEdit(creneau)}>
              <Edit className="mr-2 h-4 w-4" />
              {tc("edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!creneau.isArchived ? (
              <DropdownMenuItem onClick={() => handleArchive(creneau)}>
                <Archive className="mr-2 h-4 w-4" />
                {tc("archive")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => handleDelete(creneau)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {tc("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ],
    [handleArchive, handleDelete, handleEdit, locale, t, tc],
  );

  const cardConfig = useMemo(
    () => ({
    title: (creneau: ICreneau) => creneau.nameCreneau,
    subtitle: (creneau: ICreneau) =>
      t("cardSubtitle", {
        start: creneau.startTime,
        end: creneau.endTime,
        minutes: creneau.durationCourse,
      }),
    details: (creneau: ICreneau) => {
      const preview = previewPeriodsAroundRecreation(
        creneau.startTime,
        creneau.endTime,
        creneau.durationCourse,
        creneau.recreationHour,
        creneau.recreationDuration,
      );

      return [
        {
          label: t("columnRecreation"),
          value: `${creneau.recreationHour} (${creneau.recreationDuration} min)`,
        },
        {
          label: t("columnSessions"),
          value: preview
            ? `${preview.before} + ${preview.after} (${t("sessionsCount", { count: preview.total })})`
            : "—",
        },
        {
          label: tc("status"),
          value: creneau.isArchived ? t("archived") : tc("activeFeminine"),
        },
      ];
    },
    actions: (creneau: ICreneau) => [
      {
        label: tc("edit"),
        icon: Edit,
        onClick: () => handleEdit(creneau),
        variant: "outline" as const,
      },
      ...(creneau.isArchived
        ? []
        : [
            {
              label: tc("archive"),
              icon: Archive,
              onClick: () => handleArchive(creneau),
              variant: "outline" as const,
            },
          ]),
      {
        label: tc("delete"),
        icon: Trash2,
        onClick: () => handleDelete(creneau),
        variant: "outline" as const,
      },
    ],
  }),
    [handleArchive, handleDelete, handleEdit, t, tc],
  );

  const filterOptions = useMemo(
    () => [
      { value: "active", label: t("filterActive") },
      { value: "archived", label: t("filterArchived") },
      { value: "all", label: t("filterAll") },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <div className="flex w-full items-center justify-between">
        <SearchAndFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterValue={statusFilter}
          onFilterChange={(value) =>
            setStatusFilter(value as ActiveArchiveFilter)
          }
          filterOptions={filterOptions}
          searchPlaceholder={t("search")}
        />
      </div>

      <ResponsiveDataTable
        data={filteredCreneaux}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
        emptyMessage={t("empty")}
        searchTerm={searchTerm}
      />

      {selectedCreneau ? (
        <>
          <UpdateCreneauDialog
            open={showUpdateDialog}
            onOpenChange={setShowUpdateDialog}
            creneau={selectedCreneau}
            onSuccess={handleActionSuccess}
          />
          <DeleteCreneausDialog
            open={showArchiveDialog}
            onOpenChange={setShowArchiveDialog}
            Creneaus={[selectedCreneau]}
            showTrigger={false}
            onSuccess={handleActionSuccess}
          />
          <DeleteCreneausDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            Creneaus={[selectedCreneau]}
            showTrigger={false}
            permanent
            onSuccess={handleActionSuccess}
          />
        </>
      ) : null}
    </div>
  );
};

export default CreneausTable;
