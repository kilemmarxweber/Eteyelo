"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  GraduationCap,
  School,
  Search,
} from "lucide-react";

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
import { getAcademicPeriodOrder } from "@/lib/academic-structure";
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

type MultiSelectOption = {
  value: string;
  label: string;
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

function treatsAsAll(selected: string[], optionCount: number) {
  return (
    selected.length === 0 ||
    (optionCount > 0 && selected.length === optionCount)
  );
}

const fieldClassName =
  "h-12 w-full rounded-2xl border border-border bg-muted/40 px-4 font-normal outline-none focus:border-primary/40";

function FilterMultiSelect({
  options,
  value,
  onChange,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  unitPlural,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  allLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  unitPlural: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = value;
  const isAll = treatsAsAll(selected, options.length);
  const noneSelected = selected.length === 0;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, search]);

  const selectedOptions = options.filter((option) =>
    selected.includes(option.value),
  );

  function toggle(nextValue: string) {
    onChange(
      selected.includes(nextValue)
        ? selected.filter((item) => item !== nextValue)
        : [...selected, nextValue],
    );
  }

  function summaryLabel() {
    if (isAll) return allLabel;
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return `${selectedOptions.length} ${unitPlural} selectionnes`;
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
              isAll ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {summaryLabel()}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {!isAll ? (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0 text-[10px]"
              >
                {selectedOptions.length}
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
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
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
                {allLabel}
              </CommandItem>

              {filtered.map((option) => {
                const isSelected = selected.includes(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => toggle(option.value)}
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
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
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
              onClick={() => onChange(options.map((option) => option.value))}
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

function HiddenList({ name, values }: { name: string; values: string[] }) {
  return (
    <>
      {values.map((value) => (
        <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function ResultatsFilters({
  cycles,
  branches,
  classes,
  years,
  periods,
  selectedCycles,
  selectedBranchIds,
  selectedClasses,
  selectedYear,
  selectedPeriods,
  q,
  resultsCount,
}: {
  cycles: ResultatsCycleOption[];
  branches: ResultatsBranchOption[];
  classes: ResultatsClassOption[];
  years: ResultatsYearOption[];
  periods: ResultatsPeriodOption[];
  selectedCycles: string[];
  selectedBranchIds: string[];
  selectedClasses: string[];
  selectedYear: string;
  selectedPeriods: string[];
  q: string;
  resultsCount: number;
}) {
  const [cycleValues, setCycleValues] = useState(selectedCycles);
  const [branchIds, setBranchIds] = useState<string[]>(selectedBranchIds);
  const [classeValues, setClasseValues] = useState(selectedClasses);
  const [year, setYear] = useState(selectedYear);
  const [periodValues, setPeriodValues] = useState(selectedPeriods);

  const treatsAsAllCycles = treatsAsAll(cycleValues, cycles.length);

  const visibleBranches = useMemo(
    () =>
      treatsAsAllCycles
        ? branches
        : branches.filter((branch) =>
            branch.cycles.some((cycle) => cycleValues.includes(cycle)),
          ),
    [branches, cycleValues, treatsAsAllCycles],
  );

  const treatsAsAllSchools = treatsAsAll(branchIds, visibleBranches.length);

  const scoped = useMemo(() => {
    const matchBranch = (branchId: string) =>
      treatsAsAllSchools || branchIds.includes(branchId);
    const matchCycle = (itemCycle: string) =>
      treatsAsAllCycles || cycleValues.includes(itemCycle);
    const orderCycle = cycleValues[0];

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
          .sort(
            (left, right) =>
              getAcademicPeriodOrder(left.label, orderCycle || left.cycle) -
              getAcademicPeriodOrder(right.label, orderCycle || right.cycle),
          )
          .map((item) => item.label),
      ),
    };
  }, [
    branchIds,
    classes,
    cycleValues,
    periods,
    treatsAsAllCycles,
    treatsAsAllSchools,
    years,
  ]);

  const treatsAsAllClasses = treatsAsAll(classeValues, scoped.classes.length);
  const treatsAsAllPeriods = treatsAsAll(periodValues, scoped.periods.length);

  const schoolCount = treatsAsAllSchools
    ? visibleBranches.length
    : branchIds.length;
  const classCount = treatsAsAllClasses
    ? scoped.classes.length
    : classeValues.length;
  const periodCount = treatsAsAllPeriods
    ? scoped.periods.length
    : periodValues.length;

  useEffect(() => {
    const allowed = new Set(visibleBranches.map((branch) => branch.id));
    setBranchIds((current) => {
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleBranches]);

  useEffect(() => {
    setClasseValues((current) => {
      const next = current.filter((item) => scoped.classes.includes(item));
      return next.length === current.length ? current : next;
    });
    setPeriodValues((current) => {
      const next = current.filter((item) => scoped.periods.includes(item));
      return next.length === current.length ? current : next;
    });
    setYear((current) => {
      if (scoped.years.length === 0) return "";
      if (current && scoped.years.includes(current)) return current;
      return scoped.years[0];
    });
  }, [scoped]);

  return (
    <>
      <form className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        {treatsAsAllCycles ? null : (
          <HiddenList name="cycle" values={cycleValues} />
        )}
        {treatsAsAllSchools ? null : (
          <HiddenList name="branchId" values={branchIds} />
        )}
        {treatsAsAllClasses ? null : (
          <HiddenList name="classe" values={classeValues} />
        )}
        {treatsAsAllPeriods ? null : (
          <HiddenList name="period" values={periodValues} />
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 text-sm font-semibold text-foreground">
            Cycle
            <FilterMultiSelect
              options={cycles}
              value={cycleValues}
              onChange={setCycleValues}
              allLabel="Tous les cycles"
              searchPlaceholder="Rechercher un cycle..."
              emptyLabel="Aucun cycle trouve."
              unitPlural="cycles"
            />
          </div>

          <div className="space-y-2 text-sm font-semibold text-foreground">
            Ecoles
            <FilterMultiSelect
              options={visibleBranches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              value={branchIds}
              onChange={setBranchIds}
              allLabel="Toutes les ecoles"
              searchPlaceholder="Rechercher une ecole..."
              emptyLabel="Aucune ecole trouvee."
              unitPlural="ecoles"
            />
          </div>

          <div className="space-y-2 text-sm font-semibold text-foreground">
            Classe
            <FilterMultiSelect
              options={scoped.classes.map((classeName) => ({
                value: classeName,
                label: classeName,
              }))}
              value={classeValues}
              onChange={setClasseValues}
              allLabel="Toutes les classes"
              searchPlaceholder="Rechercher une classe..."
              emptyLabel="Aucune classe trouvee."
              unitPlural="classes"
            />
          </div>

          <label className="space-y-2 text-sm font-semibold text-foreground">
            Annee scolaire
            <select
              name="year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              disabled={scoped.years.length === 0}
              className={fieldClassName}
            >
              {scoped.years.length === 0 ? (
                <option value="">Aucune annee</option>
              ) : (
                scoped.years.map((yearName) => (
                  <option key={yearName} value={yearName}>
                    {yearName}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="space-y-2 text-sm font-semibold text-foreground">
            Periode
            <FilterMultiSelect
              options={scoped.periods.map((periodLabel) => ({
                value: periodLabel,
                label: periodLabel,
              }))}
              value={periodValues}
              onChange={setPeriodValues}
              allLabel="Toutes les periodes"
              searchPlaceholder="Rechercher une periode..."
              emptyLabel="Aucune periode trouvee."
              unitPlural="periodes"
            />
          </div>
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

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <StatCard icon={School} label="Ecoles disponibles" value={schoolCount} />
        <StatCard icon={GraduationCap} label="Classes" value={classCount} />
        <StatCard icon={CalendarDays} label="Periodes" value={periodCount} />
        <StatCard
          icon={BarChart3}
          label="Resultats trouves"
          value={resultsCount}
        />
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
        </div>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
      </div>
    </div>
  );
}
