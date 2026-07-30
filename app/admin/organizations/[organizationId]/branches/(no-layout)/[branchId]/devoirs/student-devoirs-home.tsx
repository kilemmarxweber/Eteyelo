"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  PlayCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

import { DevoirsShell } from "./devoirs-shell";
import type { DevoirListItem } from "./devoirs-client";

type Props = {
  mode: "student" | "parent";
  organizationId: string;
  branchId: string;
  assignments: DevoirListItem[];
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(a: DevoirListItem) {
  if (a.myStatus === "SUBMITTED") return "Rendu";
  if (a.myStatus === "GRADED") return "Noté";
  if (a.myStatus === "DRAFT") return "En cours";
  if (a.isUpcoming) return "À venir";
  if (a.isOpen) return "À faire";
  return "Clôturé";
}

function statusTone(label: string) {
  if (label === "Noté") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (label === "Rendu") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (label === "En cours") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  if (label === "À venir") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }
  if (label === "À faire") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

export function StudentDevoirsHome({
  mode,
  organizationId,
  branchId,
  assignments,
}: Props) {
  const base = `/admin/organizations/${organizationId}/branches/${branchId}/devoirs`;

  const groups = useMemo(() => {
    const open: DevoirListItem[] = [];
    const upcoming: DevoirListItem[] = [];
    const done: DevoirListItem[] = [];

    for (const a of assignments) {
      const submitted =
        a.myStatus === "SUBMITTED" || a.myStatus === "GRADED";
      if (submitted || (!a.isOpen && !a.isUpcoming)) {
        done.push(a);
      } else if (a.isUpcoming) {
        upcoming.push(a);
      } else {
        open.push(a);
      }
    }
    return { open, upcoming, done };
  }, [assignments]);

  const renderCard = (a: DevoirListItem) => {
    const label = statusLabel(a);
    const cta =
      mode === "parent"
        ? "Voir"
        : a.myStatus === "SUBMITTED" || a.myStatus === "GRADED"
          ? "Revoir"
          : a.isUpcoming
            ? "Aperçu"
            : a.myStatus === "DRAFT"
              ? "Continuer"
              : "Répondre";

    return (
      <li key={a.id}>
        <article className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md">
          <div className="flex gap-0">
            <div className="flex w-11 shrink-0 flex-col items-center justify-center bg-gradient-to-b from-primary/15 to-primary/5 py-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                {a.isOpen &&
                mode === "student" &&
                !["SUBMITTED", "GRADED"].includes(a.myStatus ?? "") ? (
                  <PlayCircle className="size-4" />
                ) : a.myStatus === "GRADED" || a.myStatus === "SUBMITTED" ? (
                  <CheckCircle2 className="size-4" />
                ) : a.isUpcoming ? (
                  <Lock className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`${base}/${a.id}`}
                    className="truncate text-sm font-semibold hover:text-primary hover:underline"
                  >
                    {a.title}
                  </Link>
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium",
                      statusTone(label),
                    )}
                  >
                    {label}
                  </span>
                  <span className="inline-flex h-5 items-center rounded-md border border-primary/20 bg-primary/5 px-1.5 text-[10px] text-primary">
                    {a.type === "EVALUATION" ? "Éval." : "Devoir"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                    <BookOpen className="size-3 text-primary" />
                    {a.courseName}
                  </span>
                  <span className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                    {a.className}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                    <CalendarDays className="size-3" />
                    {formatShortDate(a.startAt)} → {formatShortDate(a.dueAt)}
                  </span>
                  <span className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                    {a.questionsCount} question{a.questionsCount > 1 ? "s" : ""}
                  </span>
                  {a.myScore != null ? (
                    <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                      {a.myScore}/{a.totalPoints}
                    </span>
                  ) : null}
                </div>

                {mode === "parent" && a.learnerStatuses?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {a.learnerStatuses.map((ls) => (
                      <span
                        key={ls.studentId}
                        className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px]"
                      >
                        {ls.fullName}:{" "}
                        {statusLabel({ ...a, myStatus: ls.status })}
                        {ls.score != null
                          ? ` ${ls.score}/${a.totalPoints}`
                          : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <Button
                asChild
                size="sm"
                variant={
                  cta === "Répondre" || cta === "Continuer"
                    ? "default"
                    : "secondary"
                }
                className="h-8 shrink-0 gap-1"
              >
                <Link href={`${base}/${a.id}`}>
                  {cta}
                  <ChevronRight className="size-3.5 opacity-70" />
                </Link>
              </Button>
            </div>
          </div>
        </article>
      </li>
    );
  };

  const Section = ({
    title,
    icon: Icon,
    items,
    empty,
  }: {
    title: string;
    icon: typeof Clock;
    items: DevoirListItem[];
    empty?: string;
  }) => {
    if (!items.length && !empty) return null;
    return (
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-0.5">
          <Icon className="size-3.5 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
          <span className="text-[11px] text-muted-foreground">({items.length})</span>
        </div>
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {empty}
          </p>
        ) : (
          <ul className="space-y-2">{items.map(renderCard)}</ul>
        )}
      </section>
    );
  };

  return (
    <DevoirsShell
      title="Mes devoirs"
      description={
        mode === "parent"
          ? "Suivi des devoirs de vos enfants."
          : "Répondez aux devoirs ouverts — vos réponses sont enregistrées."
      }
    >
      {assignments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devoir"
          description="Aucun devoir publié pour votre classe pour le moment."
        />
      ) : (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card p-3 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  À faire
                </p>
                <p className="text-lg font-semibold tabular-nums text-primary">
                  {groups.open.length}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  À venir
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {groups.upcoming.length}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Terminés
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {groups.done.length}
                </p>
              </div>
            </div>
          </section>

          <Section
            title="Ouverts maintenant"
            icon={PlayCircle}
            items={groups.open}
            empty="Aucun devoir ouvert pour l’instant."
          />
          <Section title="À venir" icon={Clock} items={groups.upcoming} />
          <Section title="Terminés / clôturés" icon={CheckCircle2} items={groups.done} />
        </div>
      )}
    </DevoirsShell>
  );
}
