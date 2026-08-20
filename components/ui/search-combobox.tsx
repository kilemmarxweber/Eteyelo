"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type SearchComboboxOption = {
  value: string;
  label: string;
  search?: string;
};

type SearchComboboxProps = {
  items: SearchComboboxOption[];
  /** Valeur sélectionnée (id) — en freeText, texte saisi. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  showClear?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  onCreate?: (label: string) => void;
  createLabel?: (query: string) => string;
  /** Recherche async / filtrage serveur. */
  onQueryChange?: (query: string) => void;
  /**
   * Saisie libre dans le champ (comme le patient RDV HK+).
   * `value` = texte affiché ; choisir un item appelle `onSelectItem`.
   */
  freeText?: boolean;
  onSelectItem?: (item: SearchComboboxOption) => void;
  /** false = ne pas refiltrer les items côté client. */
  filterItems?: boolean;
};

function itemSearchText(item: SearchComboboxOption) {
  return (item.search ?? item.label).toLowerCase();
}

export function SearchCombobox({
  items,
  value,
  onValueChange,
  placeholder = "Rechercher…",
  emptyText = "Aucun résultat.",
  showClear = false,
  disabled,
  id,
  className,
  onCreate,
  createLabel,
  onQueryChange,
  freeText = false,
  onSelectItem,
  filterItems = true,
}: SearchComboboxProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = items.find((item) => item.value === value);
  const inputValue = freeText
    ? value
    : open
      ? query
      : (selected?.label ?? "");

  const activeQuery = (freeText ? value : open ? query : "").trim();
  const filtered = filterItems
    ? items.filter((item) =>
        activeQuery
          ? itemSearchText(item).includes(activeQuery.toLowerCase())
          : true,
      )
    : items;

  const canCreate =
    Boolean(onCreate) &&
    activeQuery.length > 0 &&
    !items.some(
      (item) => item.label.toLowerCase() === activeQuery.toLowerCase(),
    );

  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (!freeText) setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [freeText]);

  function commitSelect(item: SearchComboboxOption) {
    if (freeText) {
      onSelectItem?.(item);
      if (!onSelectItem) onValueChange(item.label);
    } else {
      onValueChange(item.value);
      setQuery("");
    }
    setOpen(false);
  }

  function commitCreate() {
    if (!activeQuery) return;
    onCreate?.(activeQuery);
    if (freeText) onValueChange(activeQuery);
    setOpen(false);
    if (!freeText) setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Input
          id={id}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          value={inputValue}
          className={cn(
            "pr-16",
            showClear && value ? "pr-20" : undefined,
          )}
          onFocus={() => {
            setOpen(true);
            if (!freeText) setQuery(selected?.label ?? "");
          }}
          onChange={(event) => {
            const next = event.target.value;
            setOpen(true);
            if (freeText) {
              onValueChange(next);
              onQueryChange?.(next);
              return;
            }
            setQuery(next);
            onQueryChange?.(next);
            if (selected && next !== selected.label) {
              onValueChange("");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "Enter" && canCreate) {
              event.preventDefault();
              commitCreate();
            }
          }}
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5">
          {showClear && value && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                onValueChange("");
                setQuery("");
                onQueryChange?.("");
                setOpen(false);
              }}
              aria-label="Effacer"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <ChevronsUpDown className="size-4 opacity-50" />
        </div>
      </div>

      {open ? (
        <div className="absolute z-[110] mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.length === 0 && !canCreate ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            <ul className="p-1" role="listbox">
              {filtered.map((item) => {
                const isSelected = freeText
                  ? item.label.toLowerCase() === value.trim().toLowerCase()
                  : item.value === value;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/60",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => commitSelect(item)}
                    >
                      <Check
                        className={cn(
                          "size-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
              {canCreate ? (
                <li>
                  <button
                    type="button"
                    className="flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-left text-sm text-primary outline-none hover:bg-accent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={commitCreate}
                  >
                    {createLabel
                      ? createLabel(activeQuery)
                      : `+ Ajouter «${activeQuery}»`}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
