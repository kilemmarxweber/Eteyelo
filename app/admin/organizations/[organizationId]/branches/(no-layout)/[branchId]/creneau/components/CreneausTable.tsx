"use client";

import React, { useEffect, useState } from "react";
import { Coffee, Edit, Archive, MoreHorizontal, Clock } from "lucide-react";

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

interface CreneausTableProps {
  refreshKey?: string;
}

function PeriodBadge({ creneau }: { creneau: ICreneau }) {
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
        {preview.total} séances
      </span>
    </div>
  );
}

const CreneausTable: React.FC<CreneausTableProps> = ({ refreshKey }) => {
  const [creneaux, setCreneaus] = useState<ICreneau[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ActiveArchiveFilter>("active");

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
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
    setShowUpdateDialog(true);
  };

  const handleDelete = (creneau: ICreneau) => {
    setSelectedCreneau(creneau);
    setShowDeleteDialog(true);
  };

  const handleActionSuccess = () => {
    setShowUpdateDialog(false);
    setShowDeleteDialog(false);
    setSelectedCreneau(null);
    setLocalRefreshKey((value) => value + 1);
  };

  const columns = [
    {
      key: "nameCreneau",
      header: "Vacation",
      cell: (creneau: ICreneau) => (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{creneau.nameCreneau}</span>
            {creneau.isArchived ? (
              <Badge variant="outline" size="xs">
                Archivée
              </Badge>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">
            Créée le {new Date(creneau.createdAt).toLocaleDateString("fr-FR")}
          </span>
        </div>
      ),
    },
    {
      key: "schedule",
      header: "Horaires",
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
              Séance {creneau.durationCourse} min
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "recreation",
      header: "Récréation",
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
      header: "Séances",
      cell: (creneau: ICreneau) => <PeriodBadge creneau={creneau} />,
    },
    {
      key: "actions",
      header: "",
      cell: (creneau: ICreneau) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => handleEdit(creneau)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            {!creneau.isArchived ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDelete(creneau)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archiver
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const cardConfig = {
    title: (creneau: ICreneau) => creneau.nameCreneau,
    subtitle: (creneau: ICreneau) =>
      `${creneau.startTime} – ${creneau.endTime} · séance ${creneau.durationCourse} min`,
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
          label: "Récréation",
          value: `${creneau.recreationHour} (${creneau.recreationDuration} min)`,
        },
        {
          label: "Séances",
          value: preview
            ? `${preview.before} + ${preview.after} (${preview.total} séances)`
            : "—",
        },
        {
          label: "Statut",
          value: creneau.isArchived ? "Archivée" : "Active",
        },
      ];
    },
    actions: (creneau: ICreneau) => [
      {
        label: "Modifier",
        icon: Edit,
        onClick: () => handleEdit(creneau),
        variant: "outline" as const,
      },
      ...(creneau.isArchived
        ? []
        : [
            {
              label: "Archiver",
              icon: Archive,
              onClick: () => handleDelete(creneau),
              variant: "outline" as const,
            },
          ]),
    ],
  };

  const filterOptions = [
    { value: "active", label: "Actives" },
    { value: "archived", label: "Archivées" },
    { value: "all", label: "Toutes" },
  ];

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
          searchPlaceholder="Rechercher une vacation…"
        />
      </div>

      <ResponsiveDataTable
        data={filteredCreneaux}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
        emptyMessage="Aucune vacation trouvée"
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
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            Creneaus={[selectedCreneau]}
            showTrigger={false}
            onSuccess={handleActionSuccess}
          />
        </>
      ) : null}
    </div>
  );
};

export default CreneausTable;
