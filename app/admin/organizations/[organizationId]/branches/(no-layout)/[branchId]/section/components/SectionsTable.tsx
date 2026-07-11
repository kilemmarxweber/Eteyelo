import React, { useEffect, useState } from "react";
import { ISection } from "@/src/interfaces/Section";
import { getSectionsAction } from "../section.action";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Edit, Archive, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteSectionsDialog } from "./delete-Section-dialog";
import { UpdateSectionDialog } from "./edit-Section-dialog";

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

    fetchSections();
  }, [refreshKey, localRefreshKey]);

  // Filtrer les données
  const filteredSections = sections.filter((section) => {
    const matchesSearch = 
      section.nameSection.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.codeSection.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && section.statusSection) ||
      (statusFilter === "inactive" && !section.statusSection);

    return matchesSearch && matchesStatus;
  });

  const handleEdit = (section: ISection) => {
    setSelectedSection(section);
    setShowUpdateDialog(true);
  };

  const handleDelete = (section: ISection) => {
    setSelectedSection(section);
    setShowDeleteDialog(true);
  };

  const handleActionSuccess = () => {
    // Rafraîchir les données après une action
    setShowUpdateDialog(false);
    setShowDeleteDialog(false);
    setSelectedSection(null);
    setLocalRefreshKey((value) => value + 1);
  };

  // Configuration des colonnes pour desktop
  const columns = [
    {
      key: "codeSection",
      header: "Code",
      cell: (section: ISection) => (
        <div className="font-medium">{section.codeSection}</div>
      ),
    },
    {
      key: "nameSection",
      header: "Nom de la section",
      cell: (section: ISection) => (
        <div className="font-medium">{section.nameSection}</div>
      ),
    },
    {
      key: "statusSection",
      header: "Statut",
      cell: (section: ISection) => (
        <StatusBadge 
          status={section.statusSection ? "active" : "inactive"}
          label={section.statusSection ? "Actif" : "Inactif"}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Créé le",
      cell: (section: ISection) => (
        <div className="text-sm text-muted-foreground">
          {new Date(section.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (section: ISection) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(section)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDelete(section)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archiver
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Configuration des cartes pour mobile
  const cardConfig = {
    title: (section: ISection) => section.nameSection,
    subtitle: (section: ISection) => `Code: ${section.codeSection}`,
    details: (section: ISection) => [
      {
        label: "Statut",
        value: (
          <StatusBadge 
            status={section.statusSection ? "active" : "inactive"}
            label={section.statusSection ? "Actif" : "Inactif"}
          />
        ),
      },
      {
        label: "Créé le",
        value: new Date(section.createdAt).toLocaleDateString(),
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
        label: "Archiver",
        icon: Archive,
        onClick: () => handleDelete(section),
        variant: "outline" as const,
      },
    ],
  };

  const filterOptions = [
    { value: "all", label: "Tous les statuts" },
    { value: "active", label: "Actifs uniquement" },
    { value: "inactive", label: "Inactifs uniquement" },
  ];

  return (
    <div className="space-y-4">
      <SearchAndFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={filterOptions}
        searchPlaceholder="Rechercher une section..."
      />

      <ResponsiveDataTable
        data={filteredSections}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
        emptyMessage="Aucune section trouvée"
        searchTerm={searchTerm}
      />

      {/* Dialogs */}
      {selectedSection && (
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
            onSuccess={handleActionSuccess}
          />
        </>
      )}
    </div>
  );
};

export default SectionsTable;
