"use client";

import { IconFileTypePdf } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import type {
  AttendanceCheckInCycleGroup,
  AttendanceCheckInLevel,
} from "../attendance-scan-types";

export function AttendanceClassFilters({
  cycles,
  selectedCycle,
  selectedLevel,
  selectedClasseId,
  printingClassId,
  labels,
  onSelectCycle,
  onSelectLevel,
  onSelectClass,
  onPrintClass,
}: {
  cycles: AttendanceCheckInCycleGroup[];
  selectedCycle?: AttendanceCheckInCycleGroup;
  selectedLevel?: AttendanceCheckInLevel;
  selectedClasseId: string;
  printingClassId: string | null;
  labels: {
    cycle: string;
    level: string;
    classe: string;
    studentsCount: (count: number) => string;
    printPdf: string;
    noClasses: string;
  };
  onSelectCycle: (cycle: AttendanceCheckInCycleGroup) => void;
  onSelectLevel: (level: AttendanceCheckInLevel) => void;
  onSelectClass: (classeId: string) => void;
  onPrintClass: (classeId: string) => void;
}) {
  return (
    <div className="shrink-0 space-y-3 rounded-2xl border bg-muted/40 p-2.5 sm:p-3">
      {cycles.length > 1 ? (
        <div className="space-y-1.5">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {labels.cycle}
          </p>
          <div
            role="tablist"
            className="grid gap-1 rounded-xl bg-background p-1 shadow-sm"
            style={{
              gridTemplateColumns: `repeat(${Math.min(cycles.length, 4)}, minmax(0, 1fr))`,
            }}
          >
            {cycles.map((cycle) => {
              const active = cycle.key === selectedCycle?.key;
              return (
                <button
                  key={cycle.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectCycle(cycle)}
                  className={cn(
                    "truncate rounded-lg px-2 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {cycle.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedCycle?.levels.length ? (
        <div className="space-y-1.5">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {labels.level}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedCycle.levels.map((level) => {
              const active = level.key === selectedLevel?.key;
              return (
                <button
                  key={level.key}
                  type="button"
                  onClick={() => onSelectLevel(level)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedLevel?.classes.length ? (
        <div className="space-y-1.5">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {labels.classe}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {selectedLevel.classes.map((classe) => {
              const active = classe.id === selectedClasseId;
              return (
                <div
                  key={classe.id}
                  className={cn(
                    "flex min-w-0 items-stretch overflow-hidden rounded-xl border transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "bg-background hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectClass(classe.id)}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold leading-tight">
                        {classe.name}
                      </span>
                      {classe.hasUpcomingSession ? (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {labels.studentsCount(classe.studentCount)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={labels.printPdf}
                    title={labels.printPdf}
                    disabled={printingClassId === classe.id}
                    onClick={() => onPrintClass(classe.id)}
                    className="flex w-10 shrink-0 items-center justify-center border-l text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <IconFileTypePdf className="size-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
          {labels.noClasses}
        </p>
      )}
    </div>
  );
}
