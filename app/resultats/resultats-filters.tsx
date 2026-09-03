"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronsUpDown, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

export type ResultatsCycleOption = {
  value: string;
  label: string;
};

export type ResultatsBranchOption = {
  id: string;
  name: string;
  cycles: string[];
};

export type ResultatsClassOption = {
  name: string;
  branchId: string;
  cycle: string;
};

export type ResultatsYearOption = {
  name: string;
  branchId: string;
};

export type ResultatsPeriodOption = {
  label: string;
  branchId: string;
  cycle: string;
};

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

const fieldClassName =
  "h-12 w-full rounded-2xl border border-border bg-muted/40 px-4 font-normal outline-none focus:border-primary/40";

function SchoolMultiSelect({
  branches,
  value,
  onChange,
}: {
  branches: ResultatsBranchOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = value;
  const allSelected =
    branches.length > 0 && selected.length === branches.length;
  const treatsAsAll = selected.length === 0 || allSelected;
  const noneSelected = selected.length === 0;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      branch.name.toLowerCase().includes(query),
    );
  }, [branches, search]);

  const selectedBranches = branches.filter((branch) =>
    selected.includes(branch.id),
  );

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }

  function summaryLabel() {
    if (treatsAsAll) return "Toutes les ecoles";
    if (selectedBranches.length === 1) return selectedBranches[0].name;
    return `${selectedBranches.length} ecoles selectionnees`;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            fieldClassName,
            "flex items-center justify-between gap-2 text-left text-sm hover:border-primary/30",
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate",
              treatsAsAll ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {summaryLabel()}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {!treatsAsAll ? (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0 text-[10px]"
              >
                {selectedBranches.length}
              </Badge>
            ) : null}
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher une ecole..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>Aucune ecole trouvee.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange([]);
                  setOpen(false);
                }}
              >
                <span
                  className={cn(
                    "mr-2 flex size-4 items-center justify-center rounded-sm border",
                    noneSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background",
                  )}
                >
                  {noneSelected ? <Check className="size-3" /> : null}
                </span>
                Toutes les ecoles
              </CommandItem>

              {filtered.map((branch) => {
                const isSelected = selected.includes(branch.id);

                return (
                  <CommandItem
                    key={branch.id}
                    value={branch.id}
                    onSelect={() => toggle(branch.id)}
                  >
                    <span
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      )}
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-full"
              onClick={() => onChange(branches.map((branch) => branch.id))}
            >
              Tout selectionner
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-full"
              onClick={() => onChange([])}
            >
              Effacer
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ResultatsFilters({
  cycles,
  branches,
  classes,
  years,
  periods,
  selectedCycle,
  selectedBranchIds,
  selectedClasse,
  selectedYear,
  selectedPeriod,
  q,
}: {
  cycles: ResultatsCycleOption[];
  branches: ResultatsBranchOption[];
  classes: ResultatsClassOption[];
  years: ResultatsYearOption[];
  periods: ResultatsPeriodOption[];
  selectedCycle: string;
  selectedBranchIds: string[];
  selectedClasse: string;
  selectedYear: string;
  selectedPeriod: string;
  q: string;
}) {
  const [cycle, setCycle] = useState(selectedCycle);
  const [branchIds, setBranchIds] = useState<string[]>(selectedBranchIds);
  const [classe, setClasse] = useState(selectedClasse);
  const [year, setYear] = useState(selectedYear);
  const [period, setPeriod] = useState(selectedPeriod);

  const visibleBranches = useMemo(
    () =>
      cycle
        ? branches.filter((branch) => branch.cycles.includes(cycle))
        : branches,
    [branches, cycle],
  );

  const allSelected =
    visibleBranches.length > 0 &&
    visibleBranches.every((branch) => branchIds.includes(branch.id)) &&
    branchIds.length === visibleBranches.length;
  const treatsAsAllSchools = branchIds.length === 0 || allSelected;

  const scoped = useMemo(() => {
    const matchBranch = (branchId: string) =>
      treatsAsAllSchools || branchIds.includes(branchId);
    const matchCycle = (itemCycle: string) => !cycle || itemCycle === cycle;

    return {
      classes: uniqueInOrder(
        classes
          .filter(
            (item) => matchBranch(item.branchId) && matchCycle(item.cycle),
          )
          .map((item) => item.name),
      ),
      years: uniqueInOrder(
        years
          .filter((item) => matchBranch(item.branchId))
          .map((item) => item.name),
      ),
      periods: uniqueInOrder(
        periods
          .filter(
            (item) => matchBranch(item.branchId) && matchCycle(item.cycle),
          )
          .map((item) => item.label),
      ),
    };
  }, [branchIds, classes, cycle, periods, treatsAsAllSchools, years]);

  useEffect(() => {
    const allowed = new Set(visibleBranches.map((branch) => branch.id));
    setBranchIds((current) => {
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleBranches]);

  useEffect(() => {
    if (classe && !scoped.classes.includes(classe)) setClasse("");
    if (year && !scoped.years.includes(year)) setYear("");
    if (period && !scoped.periods.includes(period)) setPeriod("");
  }, [classe, period, scoped, year]);

  return (
    <form className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      {treatsAsAllSchools
        ? null
        : branchIds.map((id) => (
            <input key={id} type="hidden" name="branchId" value={id} />
          ))}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-2 text-sm font-semibold text-foreground">
          Cycle
          <select
            name="cycle"
            value={cycle}
            onChange={(event) => setCycle(event.target.value)}
            className={fieldClassName}
          >
            <option value="">Tous les cycles</option>
            {cycles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2 text-sm font-semibold text-foreground">
          Ecoles
          <SchoolMultiSelect
            branches={visibleBranches}
            value={branchIds}
            onChange={setBranchIds}
          />
        </div>

        <label className="space-y-2 text-sm font-semibold text-foreground">
          Classe
          <select
            name="classe"
            value={classe}
            onChange={(event) => setClasse(event.target.value)}
            className={fieldClassName}
          >
            <option value="">Toutes les classes</option>
            {scoped.classes.map((classeName) => (
              <option key={classeName} value={classeName}>
                {classeName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-semibold text-foreground">
          Annee scolaire
          <select
            name="year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className={fieldClassName}
          >
            <option value="">Toutes les annees</option>
            {scoped.years.map((yearName) => (
              <option key={yearName} value={yearName}>
                {yearName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-semibold text-foreground">
          Periode
          <select
            name="period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className={fieldClassName}
          >
            <option value="">Toutes les periodes</option>
            {scoped.periods.map((periodLabel) => (
              <option key={periodLabel} value={periodLabel}>
                {periodLabel}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="space-y-2 text-sm font-semibold text-foreground">
          Recherche eleve
          <div className="relative">
            <Search className="absolute left-3 top-4 size-4 text-primary" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Nom, prenom, postnom..."
              className="h-12 w-full rounded-2xl border border-border bg-muted/40 pl-10 pr-4 font-normal outline-none focus:border-primary/40"
            />
          </div>
        </label>

        <Button asChild variant="outline" className="h-12 rounded-full">
          <Link href="/resultats">Reinitialiser</Link>
        </Button>

        <Button className="h-12 rounded-full px-6">
          Afficher les resultats
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </form>
  );
}
