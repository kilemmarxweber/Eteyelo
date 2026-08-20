"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  reviewAbsenceJustificationAction,
  submitAbsenceJustificationAction,
} from "@/lib/actions/absence.actions";

export type AbsenceCaseDialogData = {
  id: string;
  status: string;
  subjectType: string;
  contextLabel: string;
  occurredOn: string;
  personName: string;
  justification: string | null;
  reviewComment: string | null;
};

function formatOccurredOn(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function subjectLabel(type: string) {
  if (type === "TEACHER") return "Enseignant";
  if (type === "PERSONNEL") return "Personnel";
  return "Élève";
}

export function AbsenceCaseDialog({
  open,
  onOpenChange,
  mode,
  caseRow,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "justify" | "review" | "view";
  caseRow: AbsenceCaseDialogData | null;
  onDone?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const title =
    mode === "justify"
      ? "Justifier l'absence"
      : mode === "review"
        ? "Examiner la justification"
        : "Détail de l'absence";

  async function submitJustification() {
    if (!caseRow) return;
    setBusy(true);
    try {
      const [, err] = await submitAbsenceJustificationAction({
        caseId: caseRow.id,
        justification: text,
      });
      if (err) {
        toast.error(
          err.message || "Impossible d'envoyer la justification.",
        );
        return;
      }
      toast.success("Justification envoyée. La direction va l'examiner.");
      setText("");
      onOpenChange(false);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  async function review(decision: "ACCEPTED" | "REJECTED") {
    if (!caseRow) return;
    setBusy(true);
    try {
      const [, err] = await reviewAbsenceJustificationAction({
        caseId: caseRow.id,
        decision,
        comment: text || undefined,
      });
      if (err) {
        toast.error(err.message || "Impossible d'enregistrer la décision.");
        return;
      }
      toast.success(
        decision === "ACCEPTED"
          ? "Justification acceptée. Un retour a été signalé."
          : "Justification refusée.",
      );
      setText("");
      onOpenChange(false);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setText("");
        onOpenChange(next);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {caseRow
              ? `${caseRow.personName} · ${subjectLabel(caseRow.subjectType)}`
              : "Absence"}
          </DialogDescription>
        </DialogHeader>

        {caseRow ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Séance : </span>
              {caseRow.contextLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Date : </span>
              {formatOccurredOn(caseRow.occurredOn)}
            </p>
            {caseRow.justification ? (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Justification
                </p>
                <p className="mt-1 whitespace-pre-wrap">{caseRow.justification}</p>
              </div>
            ) : null}
            {caseRow.reviewComment ? (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Décision
                </p>
                <p className="mt-1 whitespace-pre-wrap">{caseRow.reviewComment}</p>
              </div>
            ) : null}

            {mode === "justify" ? (
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Expliquez le motif de votre absence…"
                rows={5}
              />
            ) : null}

            {mode === "review" ? (
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Commentaire de décision (optionnel)"
                rows={3}
              />
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {mode === "justify" ? (
            <Button
              type="button"
              disabled={busy || text.trim().length < 8}
              onClick={() => void submitJustification()}
            >
              Envoyer la justification
            </Button>
          ) : null}
          {mode === "review" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void review("REJECTED")}
              >
                <X className="mr-1.5 size-3.5" />
                Refuser
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void review("ACCEPTED")}
              >
                <Check className="mr-1.5 size-3.5" />
                Accepter
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
