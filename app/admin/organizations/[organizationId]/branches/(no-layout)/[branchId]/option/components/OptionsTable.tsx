import React, { useEffect, useState } from "react";
import { IOption } from "@/src/interfaces/Option";
import { getOptionsAction } from "../option.action";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteOptionsDialog } from "./delete-Option-dialog";
import { UpdateOptionDialog } from "./edit-Option-dialog";

interface OptionsTableProps {
  refreshKey?: string;
}

const OptionsTable: React.FC<OptionsTableProps> = ({ refreshKey }) => {
  const [options, setOptions] = useState<IOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOption, setSelectedOption] = useState<IOption | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true);
        const [rawOptions, err] = await getOptionsAction();
        if (err) {
          throw new Error("Failed to fetch options");
        }
        setOptions(rawOptions);
      } catch (error) {
        console.error("Échec de récupérer les options", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [refreshKey]);

  // Filtrer les données
  const filteredOptions = options.filter((option) => {
    const matchesSearch =
      option.nameOption.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.codeOption.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.nameSection?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.codeSection?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && option.statusOption) ||
      (statusFilter === "inactive" && !option.statusOption);

    return matchesSearch && matchesStatus;
  });

  const handleEdit = (option: IOption) => {
    setSelectedOption(option);
    setShowUpdateDialog(true);
  };

  const handleDelete = (option: IOption) => {
    setSelectedOption(option);
    setShowDeleteDialog(true);
  };

  const handleActionSuccess = () => {
    // Rafraîchir les données après une action
    window.location.reload();
  };

  // Configuration des colonnes pour desktop
  const columns = [
    {
      key: "codeOption",
      header: "Code",
      cell: (option: IOption) => (
        <div className="font-medium">{option.codeOption}</div>
      ),
    },
    {
      key: "nameOption",
      header: "Nom de l'option",
      cell: (option: IOption) => (
        <div className="font-medium">{option.nameOption}</div>
      ),
    },
    {
      key: "section",
      header: "Section",
      cell: (option: IOption) => (
        <div className="text-sm text-muted-foreground">
          {option.nameSection || "Non assignée"}
        </div>
      ),
    },
    {
      key: "statusOption",
      header: "Statut",
      cell: (option: IOption) => (
        <StatusBadge
          status={option.statusOption ? "active" : "inactive"}
          label={option.statusOption ? "Actif" : "Inactif"}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Créé le",
      cell: (option: IOption) => (
        <div className="text-sm text-muted-foreground">
          {new Date(option.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (option: IOption) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(option)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(option)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Configuration des cartes pour mobile
  const cardConfig = {
    title: (option: IOption) => option.nameOption,
    subtitle: (option: IOption) => `Code: ${option.codeOption}`,
    details: (option: IOption) => [
      {
        label: "Section",
        value: option?.nameSection || "Non assignée",
      },
      {
        label: "Statut",
        value: (
          <StatusBadge
            status={option.statusOption ? "active" : "inactive"}
            label={option.statusOption ? "Actif" : "Inactif"}
          />
        ),
      },
      {
        label: "Créé le",
        value: new Date(option.createdAt).toLocaleDateString(),
      },
    ],
    actions: (option: IOption) => [
      {
        label: "Modifier",
        icon: Edit,
        onClick: () => handleEdit(option),
        variant: "outline" as const,
      },
      {
        label: "Supprimer",
        icon: Trash2,
        onClick: () => handleDelete(option),
        variant: "destructive" as const,
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
        searchPlaceholder="Rechercher une option..."
      />

      <ResponsiveDataTable
        data={filteredOptions}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
        emptyMessage="Aucune option trouvée"
        searchTerm={searchTerm}
      />

      {/* Dialogs */}
      {selectedOption && (
        <>
          <UpdateOptionDialog
            open={showUpdateDialog}
            onOpenChange={setShowUpdateDialog}
            option={selectedOption}
            onSuccess={handleActionSuccess}
          />

          <DeleteOptionsDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            Options={[selectedOption]}
            showTrigger={false}
            onSuccess={handleActionSuccess}
          />
        </>
      )}
    </div>
  );
};

export default OptionsTable;
