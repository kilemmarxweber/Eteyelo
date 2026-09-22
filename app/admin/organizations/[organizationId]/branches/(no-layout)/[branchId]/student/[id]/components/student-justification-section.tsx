"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AbsenceCaseDialog,
  AbsenceProofImages,
  type AbsenceCaseDialogData,
} from "@/components/absence-case-dialog";
import { getStudentAbsenceCasesAction } from "@/lib/actions/absence.actions";

function statusVariant(status: string) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "REJECTED") return "destructive" as const;
  if (status === "PENDING_REVIEW") return "warning" as const;
  return "outline" as const;
}

function formatOccurredOn(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

export function StudentJustificationSection({ studentId }: { studentId: string }) {
  const t = useTranslations("dashboard.absence");
  const tProfile = useTranslations("users.students.profile");
  const [cases, setCases] = useState<AbsenceCaseDialogData[]>([]);
  const [canJustify, setCanJustify] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{
    mode: "justify" | "review" | "view";
    caseRow: AbsenceCaseDialogData;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, error] = await getStudentAbsenceCasesAction({ studentId });
      if (error) {
        toast.error(error.message || "Impossible de charger les justifications.");
        return;
      }
      if (!data) return;
      setCases(data.cases);
      setCanJustify(data.canJustify);
      setCanReview(data.canReview);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCase(row: AbsenceCaseDialogData) {
    const caseRow = row;
    const canSubmit =
      canJustify && (row.status === "OPEN" || row.status === "REJECTED");
    const mode = canSubmit
      ? "justify"
      : canReview && row.status === "PENDING_REVIEW"
        ? "review"
        : "view";
    setDialog({ mode, caseRow });
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{tProfile("justificationsTitle")}</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {tProfile("justificationsDesc")}
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">{tProfile("justificationsLoading")}</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCases")}</p>
        ) : (
          <div className="space-y-2">
            {cases.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.contextLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatOccurredOn(row.occurredOn)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={statusVariant(row.status)}>
                      {t(
                        row.status === "OPEN"
                          ? "open"
                          : row.status === "PENDING_REVIEW"
                            ? "pending"
                            : row.status === "ACCEPTED"
                              ? "accepted"
                              : row.status === "REJECTED"
                                ? "rejected"
                                : "open",
                      )}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openCase(row)}
                    >
                      {canJustify &&
                      (row.status === "OPEN" || row.status === "REJECTED")
                        ? t("viewJustify")
                        : canReview && row.status === "PENDING_REVIEW"
                          ? t("examine")
                          : tProfile("justificationView")}
                    </Button>
                  </div>
                </div>
                {row.status === "ACCEPTED" ? (
                  <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      {t("superiorResponse")}
                    </p>
                    {row.reviewerName ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("acceptedBy", { name: row.reviewerName })}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {row.reviewComment?.trim() || t("accepted")}
                    </p>
                  </div>
                ) : null}
                {row.justificationImageUrls?.length ? (
                  <div className="mt-2">
                    <AbsenceProofImages urls={row.justificationImageUrls} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <AbsenceCaseDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        mode={dialog?.mode ?? "view"}
        caseRow={dialog?.caseRow ?? null}
        onDone={() => void load()}
      />
    </div>
  );
}
