"use client";

import { useEffect, useMemo, useState } from "react";
import { GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";
import { cn } from "@/lib/utils";
import type { BranchStructureMergeSelection } from "@/lib/branch-structure-merge";

import { mergeBranchStructureAction } from "./branch-structure-merge.action";

export type MergeableBranch = {
  id: string;
  name: string;
  typebranch: string;
  isActive: boolean;
  counts: {
    sections: number;
    options: number;
    cours: number;
    ponderations: number;
    classes: number;
  };
};

const DEFAULT_SELECTION: BranchStructureMergeSelection = {
  sections: true,
  options: true,
  cours: true,
  ponderations: true,
  classes: true,
};

const ITEM_LABELS: Array<{
  key: keyof BranchStructureMergeSelection;
  label: string;
  hint: string;
}> = [
  { key: "sections", label: "Sections", hint: "Filières / sections" },
  { key: "options", label: "Options", hint: "Options liées aux sections" },
  { key: "cours", label: "Cours", hint: "Matières et codes" },
  { key: "ponderations", label: "Pondérations", hint: "Cours × option × niveau" },
  { key: "classes", label: "Classes", hint: "Sans élèves ni enseignants" },
];

function typeLabel(typebranch: string) {
  return typebranch.replace(/_/g, " ").toLowerCase();
}

export function MergeStructureDialog({
  organizationId,
  branches,
  defaultSourceId,
  triggerLabel = "Copier la structure",
  triggerClassName,
  compactTrigger = false,
  hideTrigger = false,
  open: openProp,
  onOpenChange,
}: {
  organizationId: string;
  branches: MergeableBranch[];
  defaultSourceId?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  compactTrigger?: boolean;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? openProp : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [sourceId, setSourceId] = useState(defaultSourceId ?? "");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [selection, setSelection] =
    useState<BranchStructureMergeSelection>(DEFAULT_SELECTION);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setSourceId(defaultSourceId ?? "");
    setTargetIds([]);
    setSelection(DEFAULT_SELECTION);
  }, [open, defaultSourceId]);

  const source = branches.find((branch) => branch.id === sourceId);
  const targets = useMemo(
    () => branches.filter((branch) => branch.id !== sourceId),
    [branches, sourceId],
  );

  const toggleTarget = (id: string, checked: boolean) => {
    setTargetIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id),
    );
  };

  const toggleItem = (
    key: keyof BranchStructureMergeSelection,
    checked: boolean,
  ) => {
    setSelection((prev) => ({ ...prev, [key]: checked }));
  };

  const selectedCount = ITEM_LABELS.filter((item) => selection[item.key]).length;

  const openSheet = () => {
    openOverlayAfterMenuDismiss(() => setOpen(true));
  };

  const handleMerge = () => {
    if (!sourceId) {
      toast.error("Choisissez la branche source.");
      return;
    }
    if (!targetIds.length) {
      toast.error("Choisissez au moins une branche destination.");
      return;
    }
    if (!selectedCount) {
      toast.error("Choisissez au moins un élément à copier.");
      return;
    }

    startTransition(async () => {
      const result = await mergeBranchStructureAction({
        organizationId,
        sourceBranchId: sourceId,
        targetBranchIds: targetIds,
        selection,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const createdTotal = result.results.reduce(
        (sum, row) =>
          sum +
          row.created.sections +
          row.created.options +
          row.created.cours +
          row.created.ponderations +
          row.created.classes,
        0,
      );
      toast.success(
        createdTotal > 0
          ? `Structure copiée : ${createdTotal} élément${createdTotal > 1 ? "s" : ""} créé${createdTotal > 1 ? "s" : ""} vers ${result.results.length} branche${result.results.length > 1 ? "s" : ""}.`
          : "Rien de nouveau à créer : la structure existait déjà dans les destinations.",
      );
      setOpen(false);
    });
  };

  return (
    <>
      {hideTrigger ? null : compactTrigger ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={cn("size-7 shrink-0 rounded-md", triggerClassName)}
          title={triggerLabel}
          onClick={openSheet}
        >
          <GitMerge className="size-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={cn(
            "rounded-full bg-card text-foreground hover:bg-muted",
            triggerClassName,
          )}
          onClick={openSheet}
        >
          <GitMerge className="mr-1.5 size-3.5" />
          {triggerLabel}
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          overlayClassName="z-[110]"
          className="z-[110] flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>Copier la structure scolaire</SheetTitle>
            <SheetDescription>
              Duplique sections, options, cours, pondérations et classes vers
              d&apos;autres établissements. Les identifiants restent distincts ;
              les éléments déjà présents (même code ou même nom) sont réutilisés.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="space-y-1.5">
              <Label>Branche source</Label>
              <Select
                value={sourceId || undefined}
                onValueChange={(value) => {
                  setSourceId(value);
                  setTargetIds((prev) => prev.filter((id) => id !== value));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir l'établissement source" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                      {!branch.isActive ? " (archivé)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {source ? (
                <p className="text-xs text-muted-foreground">
                  {source.counts.sections} sections · {source.counts.options}{" "}
                  options · {source.counts.cours} cours ·{" "}
                  {source.counts.ponderations} pondérations ·{" "}
                  {source.counts.classes} classes
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Éléments à copier</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ITEM_LABELS.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <Checkbox
                      checked={selection[item.key]}
                      onCheckedChange={(value) =>
                        toggleItem(item.key, value === true)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Les dépendances sont ajoutées automatiquement (ex. classes →
                options → sections).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Branches destination</Label>
              {targets.length ? (
                <div className="max-h-52 space-y-1 overflow-auto rounded-lg border p-2">
                  {targets.map((branch) => {
                    const mismatch =
                      Boolean(source) &&
                      branch.typebranch !== source?.typebranch;
                    return (
                      <label
                        key={branch.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={targetIds.includes(branch.id)}
                          onCheckedChange={(value) =>
                            toggleTarget(branch.id, value === true)
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {branch.name}
                            {!branch.isActive ? " (archivé)" : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {typeLabel(branch.typebranch)}
                            {mismatch ? " · type différent" : ""}
                            {` · ${branch.counts.classes} cl.`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Aucune autre branche dans cette organisation.
                </p>
              )}
            </div>
          </div>

          <SheetFooter className="shrink-0 gap-2 border-t px-5 py-4 sm:flex-row sm:space-x-0 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="button" onClick={handleMerge} disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <GitMerge className="mr-2 size-4" />
              )}
              Fusionner
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
