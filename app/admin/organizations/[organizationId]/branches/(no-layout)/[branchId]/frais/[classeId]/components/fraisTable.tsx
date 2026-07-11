import React, { useEffect, useState } from "react";
import { IFrais } from "@/src/interfaces/Frais";
import { getFraisByClassAction, getFraisAction } from "../../frais.action";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MoreHorizontal } from "lucide-react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UpdateFraisDialog } from "./edit-Frais-dialog";
import { DeleteFraissDialog } from "./delete-Frais-dialog";

const FraissList = ({ params }: { params: { classeId: string } }) => {
  const [fraiss, setFraiss] = useState<IFrais[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 5;
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFrais, setSelectedFrais] = useState<IFrais | null>(null);

  useEffect(() => {
    const fetchFraiss = async () => {
      try {
        if (params.classeId) {
          const [rawFraiss, err] = await getFraisByClassAction({
            classeId: params.classeId,
          });
          if (err) {
            throw new Error("Failed to fetch Fraiss");
          }
          setFraiss(rawFraiss);
        } else {
          const [rawFraiss, err] = await getFraisAction({});
          if (err) {
            throw new Error("Failed to fetch Frais");
          }
          setFraiss(rawFraiss);
        }
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    fetchFraiss();
  }, [params.classeId]);

  // Filtrer les données
  const filteredFraiss = fraiss.filter((frais) => {
    return (
      frais.nameFrais.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (frais.typeFrais?.nameType
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ??
        false)
    );
  });

  const handleEdit = (frais: IFrais) => {
    setSelectedFrais(frais);
    setShowUpdateDialog(true);
  };

  const handleDelete = (frais: IFrais) => {
    setSelectedFrais(frais);
    setShowDeleteDialog(true);
  };

  // Colonnes pour desktop
  const columns = [
    {
      key: "nameFrais",
      header: "Intitulé du frais",
      cell: (frais: IFrais) => (
        <div className="font-medium">{frais.nameFrais}</div>
      ),
    },
    {
      key: "montantFrais",
      header: "Montant",
      cell: (frais: IFrais) => (
        <div className="text-green-700 font-semibold">
          {frais.montantFrais.toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      ),
    },
    {
      key: "typeFrais",
      header: "Type",
      cell: (frais: IFrais) => <div>{frais.typeFrais?.nameType || "-"}</div>,
    },
    {
      key: "createdAt",
      header: "Inscrit le",
      cell: (frais: IFrais) => (
        <div className="text-sm text-muted-foreground">
          {new Date(frais.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (frais: IFrais) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(frais)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(frais)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Désactiver
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Config carte mobile
  const cardConfig = {
    title: (frais: IFrais) => frais.nameFrais,
    subtitle: (frais: IFrais) => frais.typeFrais?.nameType || "-",
    details: (frais: IFrais) => [
      {
        label: "Montant",
        value: frais.montantFrais.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      },
      {
        label: "Inscrit le",
        value: new Date(frais.createdAt).toLocaleDateString(),
      },
    ],
    actions: (frais: IFrais) => [
      {
        label: "Modifier",
        icon: Edit,
        onClick: () => handleEdit(frais),
        variant: "outline" as const,
      },
      {
        label: "Désactiver",
        icon: Trash2,
        onClick: () => handleDelete(frais),
        variant: "destructive" as const,
      },
    ],
  };
  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;

  const paginatedFraiss = filteredFraiss.slice(start, end);
  return (
    <div className="space-y-4">
      <SearchAndFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher un frais..."
      />
      <ResponsiveDataTable
        data={paginatedFraiss}
        columns={columns}
        cardConfig={cardConfig}
        loading={loading}
        emptyMessage="Pas de frais pour cette classe"
        searchTerm={searchTerm}
      />
      {filteredFraiss.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between px-2 py-3 border-t">
          {/* Prev */}
          <button
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <IconChevronLeft size={16} />
            Prev
          </button>

          {/* Page info */}
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-muted font-medium">
              {page + 1}
            </span>
            <span className="text-muted-foreground">
              / {Math.ceil(filteredFraiss.length / ITEMS_PER_PAGE)}
            </span>
          </div>

          {/* Next */}
          <button
            disabled={end >= filteredFraiss.length}
            onClick={() => setPage((prev) => prev + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            Next
            <IconChevronRight size={16} />
          </button>
        </div>
      )}
      {/* Dialogs */}
      {selectedFrais && (
        <>
          <UpdateFraisDialog
            open={showUpdateDialog}
            onOpenChange={setShowUpdateDialog}
            frais={selectedFrais}
          />
          <DeleteFraissDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            Frais={[selectedFrais]}
            showTrigger={false}
          />
        </>
      )}
    </div>
  );
};

export default FraissList;
