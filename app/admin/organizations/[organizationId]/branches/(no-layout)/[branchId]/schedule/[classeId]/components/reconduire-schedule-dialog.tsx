"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getScheduleReconduireSourcesAction,
  reconduireScheduleFromClasseAction,
  type ScheduleReconduireSourceClasse,
} from "../../schedule.action";

type ReconduireScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetClasseId: string;
  onSuccess?: () => void;
};

export function ReconduireScheduleDialog({
  open,
  onOpenChange,
  targetClasseId,
  onSuccess,
}: ReconduireScheduleDialogProps) {
  const t = useTranslations("teaching.schedule");
  const tc = useTranslations("common");
  const [classes, setClasses] = useState<ScheduleReconduireSourceClasse[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceClasseId, setSourceClasseId] = useState("");

  useEffect(() => {
    if (!open) return;

    setSearch("");
    setSourceClasseId("");
    setLoading(true);

    void (async () => {
      const [result, error] = await getScheduleReconduireSourcesAction({
        classeId: targetClasseId,
      });
      if (error) {
        toast.error(error.message ?? t("reconduireLoadError"));
        setClasses([]);
      } else {
        setClasses(result ?? []);
      }
      setLoading(false);
    })();
  }, [open, targetClasseId, t]);

  const filtered = useMemo(
    () =>
      classes.filter((classe) =>
        `${classe.nameClasse} ${classe.codeClasse} ${classe.optionName} ${classe.sectionName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [classes, search],
  );

  async function runReconduire() {
    if (!sourceClasseId) {
      toast.error(t("reconduirePickClass"));
      return;
    }

    setSubmitting(true);
    const [result, error] = await reconduireScheduleFromClasseAction({
      targetClasseId,
      sourceClasseId,
    });
    setSubmitting(false);

    if (error || !result) {
      toast.error(error?.message ?? t("reconduireFailed"));
      return;
    }

    if (result.placed === 0) {
      toast.info(
        result.skippedOccupied +
          result.skippedConflict +
          result.skippedUnassigned >
          0
          ? t("reconduireNothingPlaced", {
              occupied: result.skippedOccupied,
              conflicts: result.skippedConflict,
              unassigned: result.skippedUnassigned,
            })
          : t("reconduireNothing"),
      );
    } else {
      toast.success(
        t("reconduireSuccess", {
          placed: result.placed,
          source: result.sourceName,
        }),
      );
      if (
        result.skippedOccupied ||
        result.skippedConflict ||
        result.skippedUnassigned
      ) {
        toast.warning(
          t("reconduireSkipped", {
            occupied: result.skippedOccupied,
            conflicts: result.skippedConflict,
            unassigned: result.skippedUnassigned,
          }),
        );
      }
    }

    onSuccess?.();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        size="lg"
        className="max-h-[min(90dvh,52rem)] gap-4 overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("reconduireTitle")}</DialogTitle>
          <DialogDescription>{t("reconduireDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("reconduireSearch")}
              className="h-9 pl-9"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("reconduireLoading")}
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("reconduireEmpty")}
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((classe) => {
                  const selected = sourceClasseId === classe.id;
                  const meta = [
                    classe.codeClasse,
                    classe.optionName,
                    classe.sectionName,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const disabled = classe.slotCount === 0;
                  return (
                    <li key={classe.id}>
                      <button
                        type="button"
                        disabled={disabled || submitting}
                        onClick={() => setSourceClasseId(classe.id)}
                        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected ? "bg-muted" : ""
                        }`}
                      >
                        <span
                          className={`mt-1 size-3.5 shrink-0 rounded-full border ${
                            selected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {classe.nameClasse}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {meta
                              ? `${meta} · ${t("reconduireSlotCount", { count: classe.slotCount })}`
                              : t("reconduireSlotCount", {
                                  count: classe.slotCount,
                                })}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            disabled={submitting || !sourceClasseId}
            onClick={() => void runReconduire()}
          >
            <Copy className="mr-2 size-4" />
            {submitting ? t("reconduireRunning") : t("reconduireConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
