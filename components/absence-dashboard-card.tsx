"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

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
    setPending(data.pending);
  }

  useEffect(() => {
    void load();
  }, []);

  if (!canReview || pending.length === 0) {
    return null;
  }

  return (
    <>
      <CaseList
        title={t("absence.review")}
        description={t("absence.reviewDesc")}
        rows={pending}
        actionLabel={t("absence.examine")}
        onOpen={(row) => setDialog({ mode: "review", caseRow: row })}
      />
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
