"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRefresh } from "@/src/hooks/RefreshContext";
import {
  deleteFraisAcrossClassesAction,
  getFraisClassSidebarAction,
} from "../../frais.action";

type SidebarClass = {
  id: string;
  nameClasse: string;
  codeClasse: string;
  optionName: string;
  sectionName: string;
  activeFraisCount: number;
};

interface DeleteFraisAcrossClassesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceClasseId: string;
  sourceClassLabel?: string;
  fraisIds?: string[];
  feeLabel?: string;
  permanent?: boolean;
  onSuccess?: () => void;
}

export function DeleteFraisAcrossClassesDialog({
  open,
  onOpenChange,
  sourceClasseId,
  sourceClassLabel,
  fraisIds,
  feeLabel,
  permanent = false,
  onSuccess,
}: DeleteFraisAcrossClassesDialogProps) {
  const { refresh } = useRefresh();
  const [classes, setClasses] = useState<SidebarClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isSingleFee = Boolean(fraisIds?.length === 1);
  const hasSpecificFees = Boolean(fraisIds?.length);
  const sourceName = sourceClassLabel || "cette classe";
  const actionVerb = permanent ? "Supprimer" : "Désactiver";

  useEffect(() => {
    if (!open) return;

    setSearch("");
    setSelectedIds([]);
    setLoadingClasses(true);

    void (async () => {
      const [result, error] = await getFraisClassSidebarAction();
      if (error) {
        toast.error(error.message ?? "Impossible de charger les classes");
        setClasses([]);
      } else {
        setClasses(result?.classes ?? []);
      }
      setLoadingClasses(false);
    })();
  }, [open]);

  const filtered = useMemo(
    () =>
      classes.filter((classe) =>
        `${classe.nameClasse} ${classe.codeClasse} ${classe.optionName} ${classe.sectionName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [classes, search],
  );

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((classe) => selectedIds.includes(classe.id));

  const toggleClass = (classeId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, classeId]))
        : current.filter((id) => id !== classeId),
    );
  };

  const toggleVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(filtered.map((classe) => classe.id));
      setSelectedIds((current) => current.filter((id) => !visible.has(id)));
      return;
    }
    setSelectedIds((current) =>
      Array.from(new Set([...current, ...filtered.map((classe) => classe.id)])),
    );
  };

  const runDelete = async (allClasses: boolean) => {
    if (!allOtherClassesSafe(allClasses, selectedIds)) {
      toast.error("Sélectionnez au moins une classe");
      return;
    }

    setSubmitting(true);
    const [result, error] = await deleteFraisAcrossClassesAction({
      sourceClasseId,
      fraisIds: fraisIds?.length ? fraisIds : undefined,
      targetClasseIds: allClasses ? undefined : selectedIds,
      allOtherClasses: allClasses,
      permanent,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? "La suppression a échoué");
      return;
    }

    const processed = result?.processed ?? 0;
    const skipped = result?.skipped ?? 0;
    const classCount = result?.classCount ?? 0;

    if (processed === 0) {
      toast.info(
        skipped > 0
          ? "Aucun frais n'a pu être supprimé (paiements liés)"
          : "Aucun frais correspondant dans les classes sélectionnées",
      );
    } else {
      toast.success(
        `${processed} frais ${
          permanent ? "supprimé" : "désactivé"
        }${processed > 1 ? "s" : ""} dans ${classCount} classe${
          classCount > 1 ? "s" : ""
        }${
          skipped > 0
            ? ` · ${skipped} ignoré${skipped > 1 ? "s" : ""} (paiements liés)`
            : ""
        }`,
      );
    }

    refresh();
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="gap-4">
        <DialogHeader>
          <DialogTitle>
            {actionVerb} les frais dans d&apos;autres classes
          </DialogTitle>
          <DialogDescription>
            {isSingleFee
              ? `${actionVerb} « ${feeLabel || "ce frais"} » de ${sourceName} dans les classes choisies (même intitulé, année en cours).`
              : hasSpecificFees
                ? `${actionVerb} les ${fraisIds?.length} frais sélectionnés de ${sourceName} dans les classes choisies (même intitulé, année en cours).`
                : `${actionVerb} les frais de ${sourceName} dans les classes choisies. Les frais du même nom sont concernés.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une classe..."
              className="h-9 pl-9"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={toggleVisible}
              disabled={loadingClasses || filtered.length === 0}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
            <p className="text-xs text-muted-foreground">
              {selectedIds.length} classe{selectedIds.length > 1 ? "s" : ""}{" "}
              sélectionnée{selectedIds.length > 1 ? "s" : ""}
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {loadingClasses ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Chargement des classes...
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Aucune classe
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((classe) => {
                  const checked = selectedIds.includes(classe.id);
                  const meta = [
                    classe.codeClasse,
                    classe.optionName,
                    classe.sectionName,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const isSource = classe.id === sourceClasseId;
                  return (
                    <li key={classe.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleClass(classe.id, value === true)
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {classe.nameClasse}
                            {isSource ? (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (cette classe)
                              </span>
                            ) : null}
                          </span>
                          {meta ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {meta}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant={permanent ? "destructive" : "default"}
            onClick={() => void runDelete(false)}
            disabled={submitting || selectedIds.length === 0}
          >
            <Trash2 className="mr-2 size-4" />
            {submitting
              ? `${actionVerb}...`
              : `${actionVerb} dans la sélection (${selectedIds.length})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runDelete(true)}
            disabled={submitting || classes.length === 0}
          >
            {actionVerb} dans toutes les classes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function allOtherClassesSafe(allClasses: boolean, selectedIds: string[]) {
  return allClasses || selectedIds.length > 0;
}
