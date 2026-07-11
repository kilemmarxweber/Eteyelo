"use client";

import React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface MultiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  maxCount?: number;
  closeOnSelect?: boolean;
  className?: string;
  disabled?: boolean;
  /** Affiche uniquement le placeholder (ou un compteur), pas les badges des éléments sélectionnés */
  hideSelected?: boolean;
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select options",
  searchable = true,
  maxCount = 1,
  closeOnSelect = false,
  className,
  disabled = false,
  hideSelected = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = value || [];

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase()),
    );
  }, [options, search]);

  const toggle = (val: string) => {
    if (disabled) return;

    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];

    onValueChange(next);

    if (closeOnSelect) setOpen(false);
  };

  const clear = () => {
    onValueChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-between min-h-9 text-sm", className)}
        >
          <div className="flex gap-1 flex-wrap items-center">
            {selected.length === 0 || hideSelected ? (
              <span className="text-muted-foreground">
                {selected.length > 0 && hideSelected
                  ? `${selected.length} frais sélectionné${selected.length > 1 ? "s" : ""}`
                  : placeholder}
              </span>
            ) : (
              <>
                {selected.slice(0, maxCount).map((val) => {
                  const opt = options.find((o) => o.value === val);
                  if (!opt) return null;

                  return (
                    <Badge key={val} variant="secondary">
                      {opt.label}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(val);
                        }}
                      />
                    </Badge>
                  );
                })}

                {selected.length > maxCount && (
                  <Badge variant="outline" className="ml-1 flex ">
                    +{selected.length - maxCount} autres
                  </Badge>
                )}
              </>
            )}
          </div>

          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[355px] p-0">
        <Command>
          <div className="flex items-center border-b px-2">
            {searchable && (
              <CommandInput
                placeholder="Rechercher..."
                value={search}
                onValueChange={setSearch}
                className="flex-1 h-9 text-sm border-none shadow-none focus-visible:ring-0"
              />
            )}
            {selected.length > maxCount && (
              <Badge
                variant="outline"
                className="ml-1 flex whitespace-nowrap h-6 shrink-0"
              >
                +{selected.length - maxCount} autres
              </Badge>
            )}
          </div>

          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>Aucun résultat.</CommandEmpty>

            <CommandGroup>
              {filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.value);

                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => toggle(opt.value)}
                    disabled={opt.disabled}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center border rounded-sm",
                        isSelected ? "bg-primary text-white" : "opacity-50",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>

                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {selected.length > 0 && (
              <div className="border-t p-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={clear}
                >
                  Effacer la sélection
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
