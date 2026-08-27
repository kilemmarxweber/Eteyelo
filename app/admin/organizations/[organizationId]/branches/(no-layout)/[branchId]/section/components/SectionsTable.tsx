"use client";

import React, { useEffect, useState } from "react";
import { Edit, Archive, MoreHorizontal, Layers, RotateCcw, Trash2 } from "lucide-react";

import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ISection } from "@/src/interfaces/Section";

import { getSectionsAction, statuSectionAction } from "../section.action";
import { DeleteSectionsDialog } from "./delete-Section-dialog";
import { UpdateSectionDialog } from "./edit-Section-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";
import { toast } from "sonner";

interface SectionsTableProps {
  refreshKey?: string;
}

const SectionsTable: React.FC<SectionsTableProps> = ({ refreshKey }) => {
  const [sections, setSections] = useState<ISection[]>([]);
  const [loading, setLoading] = useState(true);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSection, setSelectedSection] = useState<ISection | null>(null);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        setLoading(true);
        const [rawSections, err] = await getSectionsAction();
        if (err) {
          throw new Error("Failed to fetch sections");
        }
        setSections(rawSections);
      } catch (error) {
        console.error("Échec de récupérer les sections", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchSections();
  }, [refreshKey, localRefreshKey]);

  const filteredSections = sections.filter((section) => {
    const matchesSearch =
      section.nameSection.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.codeSection.toLowerCase().includes(searchTerm.toLowerCase());

    const isActive = section.statusSection !== false;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "inactive" && !isActive);

    return matchesSearch && matchesStatus;
  });

  const handleEdit = (section: ISection) => {
    setSelectedSection(section);
    openOverlayAfterMenuDismiss(() => setShowUpdateDialog(true));
  };

  const handleToggleStatus = async (section: ISection) => {
    const next = section.statusSection === false;
    const [, err] = await statuSectionAction({
      id: section.id,
      statusSection: next,
    });
    if (err) {
      toast.error(err.message ?? "Impossible de modifier le statut");
      return;
    }
    toast.success(next ? "Section activée" : "Section désactivée");
    setLocalRefreshKey((value) => value + 1);
  };

  const handleDelete = (section: ISection) => {
    setSelectedSection(section);
    openOverlayAfterMenuDismiss(() => setShowDeleteDialog(true));
  };

  const handleActionSuccess = () => {
    setShowUpdateDialog(false);
    setShowDeleteDialog(false);
    setSelectedSection(null);
    setLocalRefreshKey((value) => value + 1);
  };

  const columns = [
    {
      key: "nameSection",
      header: "Section",
      cell: (section: ISection) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Layers className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{section.nameSection}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" size="xs">
                {section.codeSection}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(section.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "statusSection",
      header: "Statut",
      cell: (section: ISection) => (
        <StatusBadge
          status={section.statusSection !== false ? "active" : "inactive"}
          label={section.statusSection !== false ? "Active" : "Inactive"}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (section: ISection) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleEdit(section)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {section.statusSection !== false ? (
              <DropdownMenuItem onClick={() => handleToggleStatus(section)}>
                <Archive className="mr-2 h-4 w-4" />
                Désactiver
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => handleToggleStatus(section)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Activer
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => handleDelete(section)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const cardConfig = {
    title: (section: ISection) => section.nameSection,
    subtitle: (section: ISection) => `Code ${section.codeSection}`,
    details: (section: ISection) => [
      {
        label: "Statut",
        value: (
          <StatusBadge
            status={section.statusSection !== false ? "active" : "inactive"}
            label={section.statusSection !== false ? "Active" : "Inactive"}
          />
        ),
      },
      {
        label: "Créée le",
        value: new Date(section.createdAt).toLocaleDateString("fr-FR"),
      },
    ],
    actions: (section: ISection) => [
      {
        label: "Modifier",
        icon: Edit,
        onClick: () => handleEdit(section),
        variant: "outline" as const,
      },
      {
        label: section.statusSection !== false ? "Désactiver" : "Activer",
        icon: section.statusSection !== false ? Archive : RotateCcw,
        onClick: () => handleToggleStatus(section),
        variant: "outline" as const,
      },
      {
        label: "Supprimer",
        icon: Trash2,
        onClick: () => handleDelete(section),
        variant: "outline" as const,
      },
    ],
  };

  const filterOptions = [
    { value: "active", label: "Actives" },
    { value: "inactive", label: "Inactives" },
    { value: "all", label: "Toutes" },
  ];

  return (
    <div className="space-y-4">
      <SearchAndFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={filterOptions}
        searchPlaceholder="Rechercher une section…"
      />

      <ResponsiveDataTable
        data={filteredSections}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
        emptyMessage="Aucune section trouvée"
        searchTerm={searchTerm}
      />

      {selectedSection ? (
        <>
          <UpdateSectionDialog
            open={showUpdateDialog}
            onOpenChange={setShowUpdateDialog}
            section={selectedSection}
            onSuccess={handleActionSuccess}
          />
          <DeleteSectionsDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            Sections={[selectedSection]}
            showTrigger={false}
            permanent
            onSuccess={handleActionSuccess}
          />
        </>
      ) : null}
    </div>
  );
};

export default SectionsTable;
