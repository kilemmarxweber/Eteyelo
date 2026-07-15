"use client";

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

interface SubjectMultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  onSelectAll?: () => void;
  onReset?: () => void;
}

export function SubjectMultiSelect({
  options,
  value,
  onChange,
  onSelectAll,
  onReset,
}: SubjectMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const toggle = (val: string) => {
    onChange(
      value.includes(val) ? value.filter((v) => v !== val) : [...value, val],
    );
  };

  const preview =
    value.length === 0
      ? "Sélectionner les matières"
      : value.length <= 2
        ? value.join(", ")
        : `${value.slice(0, 2).join(", ")} +${value.length - 2}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-[min(100%,280px)] justify-between font-normal"
        >
          <span className="truncate text-left">{preview}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Rechercher une matière…" />
          <CommandEmpty>Aucune matière</CommandEmpty>

          <CommandGroup className="max-h-56 overflow-y-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => toggle(option.value)}
                className="flex items-center gap-2"
              >
                <Checkbox checked={value.includes(option.value)} />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>

        {(onSelectAll || onReset) && (
          <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-2 py-2">
            {onSelectAll && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={onSelectAll}
              >
                Tout
              </Button>
            )}
            <span
              className={cn(
                "text-xs text-muted-foreground",
                !onSelectAll && "ml-1",
              )}
            >
              {value.length}/{options.length}
            </span>
            {onReset && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={onReset}
              >
                Réinit.
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
