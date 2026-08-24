"use client";

import { Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { getBranchTypeShortLabel } from "@/lib/branch-capabilities";
import { cn } from "@/lib/utils";

export type MemberBranchOption = {
  id: string;
  name: string;
  code: string | null;
  typebranch: string;
};

type Props = {
  branches: MemberBranchOption[];
  value: string[];
  onChange: (branchIds: string[]) => void;
  disabled?: boolean;
  error?: string;
};

export function MemberBranchPicker({
  branches,
  value,
  onChange,
  disabled,
  error,
}: Props) {
  function toggle(id: string, checked: boolean) {
    if (checked) {
      onChange([...value, id]);
      return;
    }
    onChange(value.filter((x) => x !== id));
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
          return (
            <label
              key={branch.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => toggle(branch.id, v === true)}
                disabled={disabled}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium leading-snug">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="whitespace-normal break-words leading-snug">
                    {branch.name}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {getBranchTypeShortLabel(branch.typebranch)}
                  {branch.code ? ` · ${branch.code}` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
