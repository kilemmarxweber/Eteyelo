"use client";

import React, { useEffect, useState } from "react";
import { Edit, Archive, MoreHorizontal, RotateCcw, Settings2, Trash2 } from "lucide-react";

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
import { IOption } from "@/src/interfaces/Option";

import { getOptionsAction, statusOptionAction } from "../option.action";
import { DeleteOptionsDialog } from "./delete-Option-dialog";
import { UpdateOptionDialog } from "./edit-Option-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";
import { toast } from "sonner";

interface OptionsTableProps {
  refreshKey?: string;
}

const OptionsTable: React.FC<OptionsTableProps> = ({ refreshKey }) => {
  const [options, setOptions] = useState<IOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOption, setSelectedOption] = useState<IOption | null>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

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

    void fetchOptions();
  }, [refreshKey, localRefreshKey]);

  const filteredOptions = options.filter((option) => {
    const matchesSearch =
      option.nameOption.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.codeOption.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.nameSection?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.codeSection?.toLowerCase().includes(searchTerm.toLowerCase());

    const isActive = option.statusOption !== false;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "inactive" && !isActive);

    return matchesSearch && matchesStatus;
  });

  const handleEdit = (option: IOption) => {
    setSelectedOption(option);
    openOverlayAfterMenuDismiss(() => setShowUpdateDialog(true));
  };

  const handleToggleStatus = async (option: IOption) => {
    const next = option.statusOption === false;
    const [, err] = await statusOptionAction({
      id: option.id,
      statusOption: next,
    });
    if (err) {
      toast.error(err.message ?? "Impossible de modifier le statut");
      return;
    }
    toast.success(next ? "Option activée" : "Option désactivée");
    setLocalRefreshKey((value) => value + 1);
  };

  const handleDelete = (option: IOption) => {
    setSelectedOption(option);
    openOverlayAfterMenuDismiss(() => setShowDeleteDialog(true));
  };

  const handleActionSuccess = () => {
    setShowUpdateDialog(false);
    setShowDeleteDialog(false);
    setSelectedOption(null);
    setLocalRefreshKey((value) => value + 1);
  };

  const columns = [
    {
      key: "nameOption",
      header: "Option",
      cell: (option: IOption) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Settings2 className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{option.nameOption}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" size="xs">
                {option.codeOption}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(option.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "section",
      header: "Section",
      cell: (option: IOption) => (
        <div className="text-sm">
          <div className="font-medium">
            {option.nameSection || "Non assignée"}
          </div>
          {option.codeSection ? (
            <div className="text-xs text-muted-foreground">
              {option.codeSection}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "statusOption",
      header: "Statut",
      cell: (option: IOption) => (
        <StatusBadge
          status={option.statusOption !== false ? "active" : "inactive"}
          label={option.statusOption !== false ? "Active" : "Inactive"}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (option: IOption) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleEdit(option)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {option.statusOption !== false ? (
              <DropdownMenuItem onClick={() => handleToggleStatus(option)}>
                <Archive className="mr-2 h-4 w-4" />
                Désactiver
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => handleToggleStatus(option)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Activer
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => handleDelete(option)}
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
    title: (option: IOption) => option.nameOption,
    subtitle: (option: IOption) => `Code ${option.codeOption}`,
    details: (option: IOption) => [
      {
        label: "Section",
        value: option?.nameSection || "Non assignée",
      },
      {
        label: "Statut",
        value: (
          <StatusBadge
            status={option.statusOption !== false ? "active" : "inactive"}
            label={option.statusOption !== false ? "Active" : "Inactive"}
          />
        ),
      },
      {
        label: "Créée le",
        value: new Date(option.createdAt).toLocaleDateString("fr-FR"),
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
        label: option.statusOption !== false ? "Désactiver" : "Activer",
        icon: option.statusOption !== false ? Archive : RotateCcw,
        onClick: () => handleToggleStatus(option),
        variant: "outline" as const,
      },
      {
        label: "Supprimer",
        icon: Trash2,
        onClick: () => handleDelete(option),
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
        searchPlaceholder="Rechercher une option…"
      />

      <ResponsiveDataTable
        data={filteredOptions}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
        emptyMessage="Aucune option trouvée"
        searchTerm={searchTerm}
      />

      {selectedOption ? (
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
            permanent
            onSuccess={handleActionSuccess}
          />
        </>
      ) : null}
    </div>
  );
};

export default OptionsTable;
