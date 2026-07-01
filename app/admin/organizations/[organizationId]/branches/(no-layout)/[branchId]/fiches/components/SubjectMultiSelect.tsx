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

type Option = {
  value: string;
  label: string;
};

interface SubjectMultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function SubjectMultiSelect({
  options,
  value,
  onChange,
}: SubjectMultiSelectProps) {
  const toggle = (val: string) => {
    onChange(
      value.includes(val) ? value.filter((v) => v !== val) : [...value, val],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[250px] justify-between">
          {value.length > 0
            ? `${value.length} matière(s)`
            : "Sélectionner les matières"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher..." />
          <CommandEmpty>Aucune matière</CommandEmpty>

          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => toggle(option.value)}
                className="flex items-center gap-2"
              >
                <Checkbox checked={value.includes(option.value)} />
                <span>{option.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
