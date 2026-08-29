"use client";

import { Building2 } from "lucide-react";
import { BranchTypeBadge } from "@/components/branch/branch-type-badge";
import { MemberCyclesField } from "@/components/member-cycles-field";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBranchCyclesLabel } from "@/lib/cycle";
import { cn } from "@/lib/utils";

export type MemberBranchOption = {
  id: string;
  name: string;
  code: string | null;
  typebranch: string;
  cycles: { value: string; label: string }[];
  isMultiCycle: boolean;
};

type Props = {
  branches: MemberBranchOption[];
  value: string[];
  onChange: (branchIds: string[]) => void;
  branchCycles?: Record<string, string[]>;
  onBranchCyclesChange?: (next: Record<string, string[]>) => void;
  /** Affiche le sélecteur de cycles (rôle non transverse). */
  showCycles?: boolean;
  disabled?: boolean;
  error?: string;
  cyclesError?: string;
};

export function MemberBranchPicker({
  branches,
  value,
  onChange,
  branchCycles = {},
  onBranchCyclesChange,
  showCycles = false,
  disabled,
  error,
  cyclesError,
}: Props) {
  function toggle(id: string, checked: boolean) {
    if (checked) {
      onChange([...value, id]);
      const branch = branches.find((b) => b.id === id);
      if (!branch || !onBranchCyclesChange) return;
      if (!branch.isMultiCycle && branch.cycles[0]) {
        onBranchCyclesChange({
          ...branchCycles,
          [id]: [branch.cycles[0].value],
        });
      } else if (!(id in branchCycles)) {
        onBranchCyclesChange({ ...branchCycles, [id]: [] });
      }
      return;
    }
    onChange(value.filter((x) => x !== id));
    if (onBranchCyclesChange && id in branchCycles) {
      const next = { ...branchCycles };
      delete next[id];
      onBranchCyclesChange(next);
    }
  }

  function setCyclesForBranch(branchId: string, cycles: string[]) {
    onBranchCyclesChange?.({
      ...branchCycles,
      [branchId]: cycles,
    });
  }

  if (branches.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        Aucune branche active dans cette organisation. Créez d’abord un
        établissement.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {branches.map((branch) => {
          const checked = value.includes(branch.id);
          const cycleValues = branch.cycles.map((c) => c.value);
          return (
            <div
              key={branch.id}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggle(branch.id, v === true)}
                  disabled={disabled}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium leading-snug">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="whitespace-normal break-words leading-snug">
                      {branch.name}
                    </span>
                  </span>
                  <span className="mt-1 flex min-w-0 flex-col gap-1">
                    <BranchTypeBadge
                      typebranch={branch.typebranch}
                      cycles={cycleValues.map((cycle) => ({ cycle }))}
                      className="h-5 px-1.5 text-[10px]"
                    />
                    {branch.isMultiCycle ? (
                      <span className="text-xs text-muted-foreground">
                        {formatBranchCyclesLabel(cycleValues, {
                          typebranch: branch.typebranch,
                        })}
                        {branch.code ? ` · ${branch.code}` : ""}
                      </span>
                    ) : branch.code ? (
                      <span className="text-xs text-muted-foreground">
                        {branch.code}
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>

              {showCycles && checked && branch.isMultiCycle ? (
                <div className="mt-3 border-t border-border/60 pt-3 pl-7">
                  <MemberCyclesField
                    options={branch.cycles}
                    value={branchCycles[branch.id] ?? []}
                    onChange={(next) => setCyclesForBranch(branch.id, next)}
                    isMultiCycle={branch.isMultiCycle}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {cyclesError ? (
        <p className="text-sm text-destructive">{cyclesError}</p>
      ) : null}
    </div>
  );
}
