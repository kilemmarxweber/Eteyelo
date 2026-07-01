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

// 🔥 support search optionnel
interface ComboboxProps<
  T extends { value: string; label?: string; search?: string },
> {
  label?: string;
  items: T[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  width?: number;
}

export function Combobox<
  T extends { value: string; label?: string; search?: string },
>({
  label,
  items,
  value,
  onChange,
  placeholder = "Select...",
  width = 200,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col">
      {label ? <span className="text-sm font-medium">{label}</span> : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`w-[${width}px] justify-between`}
          >
            {value
              ? items.find((item) => item.value === value)?.label
              : placeholder}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className={`w-[${width}px] p-0`}>
          <Command>
            <CommandInput
              placeholder={label ? `Search ${label}...` : placeholder}
              className="h-9"
            />

            <CommandList>
              <CommandEmpty>
                {label
                  ? `No ${label.toLowerCase()} found.`
                  : "No options found."}
              </CommandEmpty>

              <CommandGroup>
                {items.map((item) => {
                  // 🔥 texte utilisé pour la recherche
                  const searchValue = (
                    item.search ||
                    item.label ||
                    ""
                  ).toLowerCase();

                  return (
                    <CommandItem
                      key={item.value}
                      value={searchValue} // 🔥 recherche ici
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
