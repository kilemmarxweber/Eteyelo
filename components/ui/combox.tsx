"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProps<
  T extends { value: string; label?: string; search?: string },
> {
  label?: string;
  items: T[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  /** Fixed width in px. Omit to fill the parent (`w-full`). */
  width?: number;
  className?: string;
}

export function Combobox<
  T extends { value: string; label?: string; search?: string },
>({
  label,
  items,
  value,
  onChange,
  placeholder = "Select...",
  width,
  className,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const sizeStyle =
    typeof width === "number" ? ({ width: `${width}px` } as const) : undefined;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        width == null ? "w-full" : "w-auto",
        className,
      )}
      style={sizeStyle}
    >
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between font-normal"
          >
            <span className="truncate">
              {value
                ? items.find((item) => item.value === value)?.label
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput
              placeholder={label ? `Rechercher ${label}…` : placeholder}
              className="h-9"
            />

            <CommandList>
              <CommandEmpty>
                {label
                  ? `Aucun résultat pour ${label.toLowerCase()}.`
                  : "Aucun résultat."}
              </CommandEmpty>

              <CommandGroup>
                {items.map((item) => {
                  const searchValue = (
                    item.search ||
                    item.label ||
                    ""
                  ).toLowerCase();

                  return (
                    <CommandItem
                      key={item.value}
                      value={searchValue}
                      onSelect={() => {
                        onChange(item.value === value ? "" : item.value);
                        setOpen(false);
                      }}
                    >
                      {item.label}

                      <Check
                        className={cn(
                          "ml-auto",
                          value === item.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
