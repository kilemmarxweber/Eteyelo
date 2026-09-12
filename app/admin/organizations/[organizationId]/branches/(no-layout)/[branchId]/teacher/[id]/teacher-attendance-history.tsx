"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Eye,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AbsenceCaseDialog,
  type AbsenceCaseDialogData,
} from "@/components/absence-case-dialog";
import { ensureTeacherAttendanceAbsenceCaseAction } from "@/lib/actions/absence.actions";
import { cn } from "@/lib/utils";
import type {
  TeacherAttendanceStatus,
  TeacherProfileAttendance,
} from "./teacher-profile-types";

const PAGE_SIZE = 8;

function statusMeta(
  status: TeacherAttendanceStatus,
  t: (key: string) => string,
) {
  switch (status) {
    case "PRESENT":
      return {
        label: t("present"),
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "ABSENT":
      return {
        label: t("absent"),
        className:
          "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    case "LATE":
      return {
        label: t("late"),
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      };
    default:
      return {
        label: t("excused"),
        className:
          "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
  }
}

function absenceStatusMeta(
  status: string,
  tDash: (key: string) => string,
) {
  if (status === "OPEN") {
    return {
      label: tDash("absence.open"),
      className:
        "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    };
  }
  if (status === "PENDING_REVIEW") {
    return {
      label: tDash("absence.pending"),
      className:
        "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    };
  }
  if (status === "ACCEPTED") {
    return {
      label: tDash("absence.accepted"),
      className:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (status === "REJECTED") {
    return {
      label: tDash("absence.rejected"),
      className:
        "border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-300",
    };
  }
  return null;
}

function formatDate(iso: string, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string | null, locale: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function visiblePages(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }
  const items: Array<number | "…"> = [0];
  const start = Math.max(1, page - 1);
  const end = Math.min(pageCount - 2, page + 1);
  if (start > 1) items.push("…");
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < pageCount - 2) items.push("…");
  items.push(pageCount - 1);
  return items;
}

function toDialogCase(
  row: TeacherProfileAttendance,
  personName: string,
  caseRow: NonNullable<TeacherProfileAttendance["absenceCase"]>,
): AbsenceCaseDialogData {
  return {
    id: caseRow.id,
    status: caseRow.status,
    subjectType: caseRow.subjectType,
    contextLabel:
      caseRow.contextLabel ||
      [row.courseName, row.className].filter(Boolean).join(" · "),
    occurredOn: caseRow.occurredOn || row.date,
    personName,
    justification: caseRow.justification,
    reviewComment: caseRow.reviewComment,
  };
}

export function TeacherAttendanceHistory({
  attendances,
  personName,
  teacherLabelLower,
  attendanceHref,
  canJustifyAbsences,
  canReviewAbsences,
  locale,
}: {
  attendances: TeacherProfileAttendance[];
  personName: string;
  teacherLabelLower: string;
  attendanceHref: string;
  canJustifyAbsences: boolean;
  canReviewAbsences: boolean;
  locale: string;
}) {
  const router = useRouter();
  const t = useTranslations("users.teachers.profile");
  const tDash = useTranslations("dashboard");
  const [page, setPage] = React.useState(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<{
    mode: "justify" | "review" | "view";
    caseRow: AbsenceCaseDialogData;
  } | null>(null);

  const pageCount = Math.max(1, Math.ceil(attendances.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = attendances.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  React.useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  async function openRow(
    row: TeacherProfileAttendance,
    mode: "justify" | "review" | "view",
  ) {
    if (row.absenceCase) {
      setDialog({
        mode,
        caseRow: toDialogCase(row, personName, row.absenceCase),
      });
      return;
    }
    if (mode !== "justify") return;
    setBusyId(row.id);
    try {
      const [data, err] = await ensureTeacherAttendanceAbsenceCaseAction({
        attendanceId: row.id,
      });
      if (err || !data) {
        toast.error(err?.message || t("justifyFailed"));
        return;
      }
      setDialog({
        mode: "justify",
        caseRow: {
          id: data.id,
          status: data.status,
          subjectType: data.subjectType,
          contextLabel: data.contextLabel,
          occurredOn: data.occurredOn,
          personName: data.personName || personName,
          justification: data.justification,
          reviewComment: data.reviewComment,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("justifyFailed"),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{t("attendanceHistory")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("recentCheckins", { teacherLower: teacherLabelLower })}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={attendanceHref}>{t("seeAll")}</Link>
          </Button>
        </div>

        <div className="divide-y">
          {pageRows.length ? (
            pageRows.map((row) => {
              const meta = statusMeta(row.status, t);
              const caseMeta = row.absenceCase
                ? absenceStatusMeta(row.absenceCase.status, tDash)
                : row.status === "ABSENT"
                  ? absenceStatusMeta("OPEN", tDash)
                  : null;
              const canJustifyThis =
                canJustifyAbsences &&
                row.status === "ABSENT" &&
                (!row.absenceCase ||
                  row.absenceCase.status === "OPEN" ||
                  row.absenceCase.status === "REJECTED");
              const canReviewThis =
                canReviewAbsences &&
                row.absenceCase?.status === "PENDING_REVIEW";
              const canViewThis = Boolean(row.absenceCase) && !canJustifyThis && !canReviewThis;

              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {row.courseName}
                      {row.className ? ` · ${row.className}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(row.date, locale)} · {formatTime(row.checkIn, locale)}{" "}
                      → {formatTime(row.checkOut, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </span>
                    {caseMeta && row.status === "ABSENT" ? (
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          caseMeta.className,
                        )}
                      >
                        {caseMeta.label}
                      </span>
                    ) : null}
                    {canJustifyThis ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5"
                        disabled={busyId === row.id}
                        onClick={() => void openRow(row, "justify")}
                      >
                        <MessageSquarePlus className="size-3.5" />
                        {t("justifyAbsence")}
                      </Button>
                    ) : null}
                    {canReviewThis ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => void openRow(row, "review")}
                      >
                        <ClipboardCheck className="size-3.5" />
                        {t("reviewAbsence")}
                      </Button>
                    ) : null}
                    {canViewThis ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5"
                        onClick={() => void openRow(row, "view")}
                      >
                        <Eye className="size-3.5" />
                        {t("viewAbsence")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noAttendance")}
            </p>
          )}
        </div>

        {attendances.length > PAGE_SIZE ? (
          <HistoryPagination
            page={safePage}
            pageCount={pageCount}
            total={attendances.length}
            onPageChange={setPage}
          />
        ) : null}
      </Card>

      <AbsenceCaseDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        mode={dialog?.mode ?? "view"}
        caseRow={dialog?.caseRow ?? null}
        onDone={() => router.refresh()}
      />
    </>
  );
}

function HistoryPagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("users.teachers.profile");
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  const pages = visiblePages(page, pageCount);

  return (
    <div className="flex flex-col gap-3 border-t bg-gradient-to-r from-primary/[0.07] via-muted/40 to-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-medium text-muted-foreground">
        {t("historyRange", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 hidden text-xs font-medium text-muted-foreground sm:inline">
          {t("pageOf", { page: page + 1, pages: pageCount })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          disabled={page === 0}
          aria-label={t("previousPage")}
          onClick={() => onPageChange(0)}
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          disabled={page === 0}
          aria-label={t("previousPage")}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((item, index) =>
          item === "…" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-1 text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              size="icon"
              variant={item === page ? "default" : "outline"}
              className={cn(
                "size-8 rounded-full text-xs font-semibold",
                item === page && "shadow-sm",
              )}
              onClick={() => onPageChange(item)}
            >
              {item + 1}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          disabled={page >= pageCount - 1}
          aria-label={t("nextPage")}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          disabled={page >= pageCount - 1}
          aria-label={t("nextPage")}
          onClick={() => onPageChange(pageCount - 1)}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
