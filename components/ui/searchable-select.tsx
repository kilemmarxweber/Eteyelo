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
  /** Ligne secondaire (ex. branche / établissement). */
  description?: React.ReactNode;
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
  /** Si fourni : proposition « + Ajouter «query» » quand aucun item exact. */
  onCreate?: (label: string) => void;
  createLabel?: (query: string) => string;
  /** Appelé à chaque frappe dans le champ de recherche (ex. recherche async). */
  onQueryChange?: (query: string) => void;
  /** false = ne pas refiltrer côté client (résultats déjà filtrés serveur). */
  shouldFilter?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  name?: string;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
};

const DEFAULT_SEARCH_THRESHOLD = 6;

function optionSearchText(option: SearchableSelectOption): string {
  if (option.search) return option.search;
  const parts: string[] = [];
  if (typeof option.label === "string") parts.push(option.label);
  if (typeof option.description === "string") parts.push(option.description);
  if (parts.length) return parts.join(" ");
  return option.value;
}

const CREATE_VALUE_PREFIX = "__create__:";

function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  emptyMessage = "Aucun résultat.",
  disabled,
  onCreate,
  createLabel,
  onQueryChange,
  shouldFilter = true,
  className,
  triggerClassName,
  id,
  name,
  onBlur,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listboxId = React.useId();

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? (value ? value : null);
  const displayDescription = selected?.description;
  const hasSecondaryLine = Boolean(displayDescription);

  const trimmedQuery = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    trimmedQuery.length > 0 &&
    !options.some(
      (option) =>
        optionSearchText(option).toLowerCase() === trimmedQuery.toLowerCase(),
    );

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        markRadixPortalInteraction(next ? 800 : 400);
        setOpen(next);
      }}
      modal={false}
    >
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
          onPointerDown={() => markRadixPortalInteraction()}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName,
            className,
            // Keep last so two-line values are never clipped by a fixed h-*.
            hasSecondaryLine ? "h-auto min-h-10 py-1.5" : "h-10",
            !displayLabel && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 overflow-hidden text-left">
            {displayLabel ? (
              <>
                <span className="block truncate leading-snug">{displayLabel}</span>
                {displayDescription ? (
                  <span className="mt-0.5 block truncate text-xs font-normal leading-snug text-muted-foreground">
                    {displayDescription}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        id={listboxId}
        role="listbox"
        align="start"
        sideOffset={4}
        collisionPadding={12}
        data-eteyelo-portal=""
        className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-1.5rem,36rem)] overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          markRadixPortalInteraction();
          event.preventDefault();
          const target = event.currentTarget as HTMLElement | null;
          const input = target?.querySelector("input");
          input?.focus();
        }}
        onCloseAutoFocus={(event) => {
          markRadixPortalInteraction(400);
          event.preventDefault();
        }}
        onPointerDownOutside={() => markRadixPortalInteraction(400)}
        onWheel={(event) => event.stopPropagation()}
      >
        <Command
          shouldFilter={shouldFilter}
          className="overflow-hidden"
          onPointerDown={() => markRadixPortalInteraction()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              markRadixPortalInteraction();
            }
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              onQueryChange?.(next);
            }}
          />
          <CommandList
            className="max-h-[min(18rem,45vh)] scroll-py-1 overflow-y-auto overscroll-contain"
            onWheelCapture={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup className="overflow-visible">
              {options.map((option) => {
                const searchValue = optionSearchText(option).toLowerCase();
                const selectedOption = value === option.value;

                return (
                  <CommandItem
                    key={option.value}
                    value={searchValue}
                    disabled={option.disabled}
                    className={cn(
                      "items-start gap-2 py-2",
                      option.description && "min-h-11",
                    )}
                    onSelect={() => {
                      markRadixPortalInteraction();
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        selectedOption ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate leading-snug">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                );
              })}
              {canCreate ? (
                <CommandItem
                  value={`${CREATE_VALUE_PREFIX}${trimmedQuery}`}
                  onSelect={() => {
                    markRadixPortalInteraction();
                    onCreate?.(trimmedQuery);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">
                    {createLabel
                      ? createLabel(trimmedQuery)
                      : `+ Ajouter «${trimmedQuery}»`}
                  </span>
                </CommandItem>
              ) : null}
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
  onCreate,
  createLabel,
  onQueryChange,
  shouldFilter,
  className,
  triggerClassName,
  id,
  name,
  onBlur,
}: SearchableSelectProps) {
  const useSearch =
    Boolean(onCreate) ||
    Boolean(onQueryChange) ||
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
      onCreate={onCreate}
      createLabel={createLabel}
      onQueryChange={onQueryChange}
      shouldFilter={shouldFilter}
      className={className}
      triggerClassName={triggerClassName}
      id={id}
      name={name}
      onBlur={onBlur}
    />
  );
}
