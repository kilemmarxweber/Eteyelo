"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Search } from "lucide-react";

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
  getFraisClassSidebarAction,
  replicateFraisAction,
} from "../../frais.action";

type SidebarClass = {
  id: string;
  nameClasse: string;
  codeClasse: string;
  optionName: string;
  sectionName: string;
  activeFraisCount: number;
};

interface ReplicateFraisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceClasseId: string;
  sourceClassLabel?: string;
  fraisIds?: string[];
  feeLabel?: string;
  onSuccess?: () => void;
}

export function ReplicateFraisDialog({
  open,
  onOpenChange,
  sourceClasseId,
  sourceClassLabel,
  fraisIds,
  feeLabel,
  onSuccess,
}: ReplicateFraisDialogProps) {
  const { refresh } = useRefresh();
  const [classes, setClasses] = useState<SidebarClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isSingleFee = Boolean(fraisIds?.length);
  const sourceName = sourceClassLabel || "cette classe";

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
        setClasses(
          (result?.classes ?? []).filter(
            (classe) => classe.id !== sourceClasseId,
          ),
        );
      }
      setLoadingClasses(false);
    })();
  }, [open, sourceClasseId]);

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
    filtered.length > 0 && filtered.every((classe) => selectedIds.includes(classe.id));

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

  const runReplicate = async (allOtherClasses: boolean) => {
    if (!allOtherClasses && selectedIds.length === 0) {
      toast.error("Sélectionnez au moins une classe");
      return;
    }

    setSubmitting(true);
    const [result, error] = await replicateFraisAction({
      sourceClasseId,
      fraisIds: fraisIds?.length ? fraisIds : undefined,
      targetClasseIds: allOtherClasses ? undefined : selectedIds,
      allOtherClasses,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? "La reconduction a échoué");
      return;
    }

    const created = result?.created ?? 0;
    const skipped = result?.skipped ?? 0;
    const classCount = result?.classCount ?? 0;

    if (created === 0) {
      toast.info(
        skipped > 0
          ? "Ces frais existent déjà dans les classes sélectionnées"
          : "Aucun frais n'a été reconduit",
      );
    } else {
      toast.success(
        `${created} frais reconduit${created > 1 ? "s" : ""} vers ${classCount} classe${classCount > 1 ? "s" : ""}${
          skipped > 0 ? ` · ${skipped} déjà existant${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}` : ""
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
          <DialogTitle>Reconduire les frais</DialogTitle>
          <DialogDescription>
            {isSingleFee
              ? `Reproduire « ${feeLabel || "ce frais"} » de ${sourceName} vers d'autres classes.`
              : `Reproduire les frais de ${sourceName} vers d'autres classes. Les frais déjà présents (même nom) sont ignorés.`}
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
                Aucune autre classe
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((classe) => {
                  const checked = selectedIds.includes(classe.id);
                  const meta = [classe.codeClasse, classe.optionName, classe.sectionName]
                    .filter(Boolean)
                    .join(" · ");
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
            onClick={() => void runReplicate(false)}
            disabled={submitting || selectedIds.length === 0}
          >
            <Copy className="mr-2 size-4" />
            {submitting
              ? "Reconduction..."
              : `Reconduire vers la sélection (${selectedIds.length})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runReplicate(true)}
            disabled={submitting || classes.length === 0}
          >
            Reconduire vers toutes les classes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
