import React, { useEffect, useState } from "react";
import { IFrais } from "@/src/interfaces/Frais";
import { getFraisByClassAction, getFraisAction } from "../../frais.action";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
import { SearchAndFilter } from "@/components/ui/search-and-filter";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MoreHorizontal, Copy, Archive } from "lucide-react";
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
import { ReplicateFraisDialog } from "./replicate-Frais-dialog";
import { DeleteFraisAcrossClassesDialog } from "./delete-Frais-across-classes-dialog";
import { useSession } from "@/lib/auth-client";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";

const FraissList = ({ params }: { params: { classeId: string } }) => {
  const { data: session, isPending: sessionPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const canPurgePermanently =
    hasMounted && !sessionPending && isOrganizationOwnerSession(session);
  const [fraiss, setFraiss] = useState<IFrais[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 5;
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [showReplicateDialog, setShowReplicateDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkPurgeDialog, setShowBulkPurgeDialog] = useState(false);
  const [showBulkAcrossDialog, setShowBulkAcrossDialog] = useState(false);
  const [selectedFrais, setSelectedFrais] = useState<IFrais | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

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

  const totalPages = Math.max(1, Math.ceil(filteredFraiss.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedFraiss = filteredFraiss.slice(start, end);
  const selectedFraiss = fraiss.filter((frais) => selectedIds.includes(frais.id));
  const allFilteredSelected =
    filteredFraiss.length > 0 &&
    filteredFraiss.every((frais) => selectedIds.includes(frais.id));

  const handleEdit = (frais: IFrais) => {
    setSelectedFrais(frais);
    setShowUpdateDialog(true);
  };

  const handleDelete = (frais: IFrais) => {
    setSelectedFrais(frais);
    setShowDeleteDialog(true);
  };

  const handlePurge = (frais: IFrais) => {
    setSelectedFrais(frais);
    setShowPurgeDialog(true);
  };

  const handleReplicate = (frais: IFrais) => {
    setSelectedFrais(frais);
    setShowReplicateDialog(true);
  };

  // Colonnes pour desktop
  const columns = [
    {
      key: "nameFrais",
      header: "Intitulé du frais",
      cell: (frais: IFrais) => (
        <div className="font-medium">
          {frais.nameFrais}
          {frais.isOptional ? (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Optionnel
            </span>
          ) : null}
        </div>
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
            <DropdownMenuItem onClick={() => handleReplicate(frais)}>
              <Copy className="mr-2 h-4 w-4" />
              Reconduire
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(frais)}
              className="text-destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Désactiver
            </DropdownMenuItem>
            {canPurgePermanently ? (
              <DropdownMenuItem
                onClick={() => handlePurge(frais)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Config carte mobile
  const cardConfig = {
    title: (frais: IFrais) =>
      frais.isOptional ? `${frais.nameFrais} (optionnel)` : frais.nameFrais,
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
        label: "Reconduire",
        icon: Copy,
        onClick: () => handleReplicate(frais),
        variant: "outline" as const,
      },
      {
        label: "Désactiver",
        icon: Archive,
        onClick: () => handleDelete(frais),
        variant: "destructive" as const,
      },
      ...(canPurgePermanently
        ? [
            {
              label: "Supprimer",
              icon: Trash2,
              onClick: () => handlePurge(frais),
              variant: "destructive" as const,
            },
          ]
        : []),
    ],
  };
  const classTotal = fraiss.reduce(
    (sum, frais) => sum + Number(frais.montantFrais || 0),
    0,
  );
  const formattedClassTotal = classTotal.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <SearchAndFilter
        searchTerm={searchTerm}
        searchPlaceholder="Rechercher un frais..."
        autoFocus
        onSearchChange={(value) => {
          setSearchTerm(value);
          setPage(0);
        }}
      />
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-sm">
            <span className="font-medium">{selectedIds.length}</span> frais
            sélectionné{selectedIds.length > 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!allFilteredSelected && filteredFraiss.length > selectedIds.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedIds(filteredFraiss.map((frais) => frais.id))
                }
              >
                Tout sélectionner ({filteredFraiss.length})
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Désactiver ({selectedIds.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBulkAcrossDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Dans d&apos;autres classes
            </Button>
            {canPurgePermanently ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkPurgeDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer ({selectedIds.length})
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <ResponsiveDataTable
          data={paginatedFraiss}
          columns={columns}
          cardConfig={cardConfig}
          loading={loading}
          emptyMessage="Pas de frais pour cette classe"
          searchTerm={searchTerm}
          getRowId={(frais) => frais.id}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          footer={
            fraiss.length > 0
              ? {
                  cells: [
                    { content: "Total", className: "font-semibold" },
                    {
                      content: formattedClassTotal,
                      className: "font-bold tabular-nums text-green-700",
                    },
                    { colSpan: 3 },
                  ],
                }
              : undefined
          }
        />
      </div>
      {filteredFraiss.length > ITEMS_PER_PAGE && (
        <div className="flex shrink-0 items-center justify-between border-t px-2 py-3">
          <button
            disabled={safePage === 0}
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <IconChevronLeft size={16} />
            Prev
          </button>

          <div className="flex items-center gap-2 text-sm">
            <span className="rounded bg-muted px-2 py-1 font-medium">
              {safePage + 1}
            </span>
            <span className="text-muted-foreground">
              / {totalPages}
            </span>
          </div>

          <button
            disabled={safePage + 1 >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
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
          {canPurgePermanently ? (
            <DeleteFraissDialog
              open={showPurgeDialog}
              onOpenChange={setShowPurgeDialog}
              Frais={[selectedFrais]}
              showTrigger={false}
              permanent
            />
          ) : null}
          <ReplicateFraisDialog
            open={showReplicateDialog}
            onOpenChange={setShowReplicateDialog}
            sourceClasseId={params.classeId}
            fraisIds={[selectedFrais.id]}
            feeLabel={selectedFrais.nameFrais}
          />
        </>
      )}
      {selectedFraiss.length > 0 ? (
        <>
          <DeleteFraissDialog
            open={showBulkDeleteDialog}
            onOpenChange={setShowBulkDeleteDialog}
            Frais={selectedFraiss}
            showTrigger={false}
            onSuccess={() => setSelectedIds([])}
          />
          {canPurgePermanently ? (
            <DeleteFraissDialog
              open={showBulkPurgeDialog}
              onOpenChange={setShowBulkPurgeDialog}
              Frais={selectedFraiss}
              showTrigger={false}
              permanent
              onSuccess={() => setSelectedIds([])}
            />
          ) : null}
          <DeleteFraisAcrossClassesDialog
            open={showBulkAcrossDialog}
            onOpenChange={setShowBulkAcrossDialog}
            sourceClasseId={params.classeId}
            fraisIds={selectedIds}
            onSuccess={() => setSelectedIds([])}
          />
        </>
      ) : null}
    </div>
  );
};

export default FraissList;
