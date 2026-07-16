"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { markRadixPortalInteraction } from "@/lib/radix-portal-dismiss";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SearchableSelectOption = {
  value: string;
  label: React.ReactNode;
  /** Texte utilisé pour filtrer (défaut : label si string) */
  search?: string;
  disabled?: boolean;
};

export type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** auto = recherche si options.length > searchThreshold */
  searchable?: boolean | "auto";
  searchThreshold?: number;
  className?: string;
  triggerClassName?: string;
  id?: string;
  name?: string;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
};

const DEFAULT_SEARCH_THRESHOLD = 6;

function optionSearchText(option: SearchableSelectOption): string {
  if (option.search) return option.search;
  if (typeof option.label === "string") return option.label;
  return option.value;
}

function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  emptyMessage = "Aucun résultat.",
  disabled,
  className,
  triggerClassName,
  id,
  name,
  onBlur,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const listboxId = React.useId();

  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          name={name}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onBlur={onBlur}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
            !value && "text-muted-foreground",
            triggerClassName,
            className,
          )}
        >
          <span className="truncate text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        id={listboxId}
        role="listbox"
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command
          onPointerDown={() => markRadixPortalInteraction()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              markRadixPortalInteraction();
            }
          }}
        >
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const searchValue = optionSearchText(option).toLowerCase();

                return (
                  <CommandItem
                    key={option.value}
                    value={searchValue}
                    disabled={option.disabled}
                    onSelect={() => {
                      markRadixPortalInteraction();
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Sélectionner…",
  searchPlaceholder,
  emptyMessage = "Aucun résultat.",
  disabled,
  searchable = "auto",
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  className,
  triggerClassName,
  id,
  name,
  onBlur,
}: SearchableSelectProps) {
  const useSearch =
    searchable === true ||
    (searchable === "auto" && options.length > searchThreshold);

  if (!useSearch) {
    return (
      <Select
        value={value || undefined}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={cn(triggerClassName, className)}
          onBlur={onBlur}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <SearchableCombobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder={
        searchPlaceholder ?? `Rechercher parmi ${options.length} éléments…`
      }
      emptyMessage={emptyMessage}
      disabled={disabled}
      className={className}
      triggerClassName={triggerClassName}
      id={id}
      name={name}
      onBlur={onBlur}
    />
  );
}
