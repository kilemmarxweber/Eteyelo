import React, { useEffect, useState } from "react";
import { ICreneau } from "@/src/interfaces/creneau";
import { getCreneauxAction } from "../creneau.action";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MoreHorizontal, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteCreneausDialog } from "./delete-Creneau-dialog";
import { UpdateCreneauDialog } from "./edit-Creneau-dialog";

interface CreneausTableProps {
  refreshKey?: string;
}

const CreneausTable: React.FC<CreneausTableProps> = ({ refreshKey }) => {
  const [creneaux, setCreneaus] = useState<ICreneau[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCreneau, setSelectedCreneau] = useState<ICreneau | null>(null);

  useEffect(() => {
    const fetchCreneaus = async () => {
      try {
        setLoading(true);
        const [rawCreneaus, err] = await getCreneauxAction();
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
  }, [refreshKey]);

  // Filtrer les données
  const filteredCreneaux = creneaux.filter((creneau) => {
    const matchesSearch =
      creneau.nameCreneau.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creneau.startTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creneau.endTime.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
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
    // Rafraîchir les données après une action
    window.location.reload();
  };

  // Configuration des colonnes pour desktop
  const columns = [
    {
      key: "nameCreneau",
      header: "Nom de la vacation",
      cell: (creneau: ICreneau) => (
        <div className="font-medium">{creneau.nameCreneau}</div>
      ),
    },
    {
      key: "startTime",
      header: "Heure de début",
      cell: (creneau: ICreneau) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{creneau.startTime}</span>
        </div>
      ),
    },
    {
      key: "endTime",
      header: "Heure de fin",
      cell: (creneau: ICreneau) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{creneau.endTime}</span>
        </div>
      ),
    },
    {
      key: "durationCourse",
      header: "Durée cours",
      cell: (creneau: ICreneau) => (
        <div className="text-sm text-muted-foreground">
          {creneau.durationCourse} min
        </div>
      ),
    },
    {
      key: "recreationHour",
      header: "Récréation",
      cell: (creneau: ICreneau) => (
        <div className="text-sm text-muted-foreground">
          {creneau.recreationHour}
        </div>
      ),
    },
    {
      key: "recreationDuration",
      header: "Durée récré",
      cell: (creneau: ICreneau) => (
        <div className="text-sm text-muted-foreground">
          {creneau.recreationDuration} min
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Créé le",
      cell: (creneau: ICreneau) => (
        <div className="text-sm text-muted-foreground">
          {new Date(creneau.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (creneau: ICreneau) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(creneau)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(creneau)}
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
    title: (creneau: ICreneau) => creneau.nameCreneau,
    subtitle: (creneau: ICreneau) =>
      `${creneau.startTime} - ${creneau.endTime}`,
    details: (creneau: ICreneau) => [
      {
        label: "Durée cours",
        value: `${creneau.durationCourse} min`,
      },
      {
        label: "Récréation",
        value: `${creneau.recreationHour} (${creneau.recreationDuration} min)`,
      },
      {
        label: "Créé le",
        value: new Date(creneau.createdAt).toLocaleDateString(),
      },
    ],
    actions: (creneau: ICreneau) => [
      {
        label: "Modifier",
        icon: Edit,
        onClick: () => handleEdit(creneau),
        variant: "outline" as const,
      },
      {
        label: "Supprimer",
        icon: Trash2,
        onClick: () => handleDelete(creneau),
        variant: "destructive" as const,
      },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-y-4">
        <SearchAndFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher une vacation..."
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
      {/* Dialogs */}
      {selectedCreneau && (
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
      )}
    </div>
  );
};

export default CreneausTable;
