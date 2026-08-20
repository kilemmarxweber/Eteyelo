"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AbsenceCaseDialog,
  type AbsenceCaseDialogData,
} from "@/components/absence-case-dialog";
import { getAbsenceDashboardAction } from "@/lib/actions/absence.actions";

function statusLabel(status: string) {
  if (status === "OPEN") return "À justifier";
  if (status === "PENDING_REVIEW") return "En examen";
  if (status === "ACCEPTED") return "Acceptée · retour";
  if (status === "REJECTED") return "Refusée";
  return status;
}

function CaseList({
  title,
  description,
  rows,
  actionLabel,
  onOpen,
}: {
  title: string;
  description: string;
  rows: AbsenceCaseDialogData[];
  actionLabel: string;
  onOpen: (row: AbsenceCaseDialogData) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardList className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.contextLabel}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.personName}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline">{statusLabel(row.status)}</Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpen(row)}
              >
                {actionLabel}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AbsenceDashboardSection() {
  const [mine, setMine] = useState<AbsenceCaseDialogData[]>([]);
  const [pending, setPending] = useState<AbsenceCaseDialogData[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [dialog, setDialog] = useState<{
    mode: "justify" | "review" | "view";
    caseRow: AbsenceCaseDialogData;
  } | null>(null);

  async function load() {
    const [data] = await getAbsenceDashboardAction();
    if (!data) return;
    setCanReview(data.canReview);
    setMine(data.mine);
    setPending(data.pending);
  }

  useEffect(() => {
    void load();
  }, []);

  const openMine = mine.filter(
    (row) => row.status === "OPEN" || row.status === "REJECTED",
  );
  const returns = mine.filter((row) => row.status === "ACCEPTED");
  const waiting = mine.filter((row) => row.status === "PENDING_REVIEW");

  if (openMine.length === 0 && waiting.length === 0 && returns.length === 0 && pending.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <CaseList
          title="Mes absences"
          description="Justifiez une absence signalée (aucun scan ni pointage)."
          rows={[...openMine, ...waiting]}
          actionLabel="Voir / justifier"
          onOpen={(row) =>
            setDialog({
              mode:
                row.status === "OPEN" || row.status === "REJECTED"
                  ? "justify"
                  : "view",
              caseRow: row,
            })
          }
        />
        {returns.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Undo2 className="h-4 w-4" />
                Retours signalés
              </CardTitle>
              <CardDescription>
                Justifications acceptées — retour enregistré dans votre compte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {returns.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm"
                >
                  {row.contextLabel}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {canReview ? (
          <CaseList
            title="Justifications à traiter"
            description="Préfet, directeur et propriétaire examinent les dossiers."
            rows={pending}
            actionLabel="Examiner"
            onOpen={(row) => setDialog({ mode: "review", caseRow: row })}
          />
        ) : null}
      </div>
      <AbsenceCaseDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        mode={dialog?.mode ?? "view"}
        caseRow={dialog?.caseRow ?? null}
        onDone={() => void load()}
      />
    </>
  );
}
