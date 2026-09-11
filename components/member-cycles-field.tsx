"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CycleOption = { value: string; label: string };

export function MemberCyclesField({
  options,
  value,
  onChange,
  isMultiCycle,
  required = true,
  className,
}: {
  options: CycleOption[];
  value: string[];
  onChange: (next: string[]) => void;
  isMultiCycle: boolean;
  required?: boolean;
  className?: string;
}) {
  if (!isMultiCycle || options.length <= 1) {
    return null;
  }

  const toggle = (cycle: string, checked: boolean) => {
    onChange(
      checked
        ? [...new Set([...value, cycle])]
        : value.filter((item) => item !== cycle),
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        Cycle(s) d&apos;affectation
        {required ? " *" : ""}
      </Label>
      <p className="text-xs text-muted-foreground">
        L&apos;utilisateur ne verra que les données de ces cycles (hors caisse
        et inscriptions).
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <div
              key={option.value}
              className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(state) =>
                  toggle(option.value, state === true)
                }
                aria-label={option.label}
              />
              <button
                type="button"
                onClick={() => toggle(option.value, !checked)}
                className="flex-1 cursor-pointer text-left"
              >
                {option.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
