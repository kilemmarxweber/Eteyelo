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
import { useTranslations } from "next-intl";

function statusLabel(
  status: string,
  t: (key: string) => string,
) {
  if (status === "OPEN") return t("absence.open");
  if (status === "PENDING_REVIEW") return t("absence.pending");
  if (status === "ACCEPTED") return t("absence.accepted");
  if (status === "REJECTED") return t("absence.rejected");
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
  const t = useTranslations("dashboard");
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
              <Badge variant="outline">{statusLabel(row.status, t)}</Badge>
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
  const t = useTranslations("dashboard");
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
          title={t("absence.mine")}
          description={t("absence.mineDesc")}
          rows={[...openMine, ...waiting]}
          actionLabel={t("absence.viewJustify")}
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
                {t("absence.returns")}
              </CardTitle>
              <CardDescription>
                {t("absence.returnsDesc")}
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
            title={t("absence.review")}
            description={t("absence.reviewDesc")}
            rows={pending}
            actionLabel={t("absence.examine")}
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
