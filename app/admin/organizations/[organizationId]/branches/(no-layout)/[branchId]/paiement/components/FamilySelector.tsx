"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { searchFamilyAction, Family, StudentItem } from "../paiement.action";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getCurrentSchoolYearAction, getSchoolYearsAction1 } from "../../schoolYear/schoolYear.action";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

interface Props {
  onChange: (data: {
    parentId: string;
    classEnrollIds: string[];
    schoolYearId: string;
  }) => void;
  resetKey?: number;
  /** Masque le sélecteur d'année (affiché ailleurs, ex. panneau gauche). */
  hideSchoolYearSelect?: boolean;
  /** Contrôle externe de l'année scolaire. */
  schoolYearId?: string;
  onSchoolYearIdChange?: (schoolYearId: string) => void;
  onSchoolYearsLoaded?: (years: ISchoolYear[]) => void;
}

export default function FamilySelector({
  onChange,
  resetKey,
  hideSchoolYearSelect = false,
  schoolYearId: controlledSchoolYearId,
  onSchoolYearIdChange,
  onSchoolYearsLoaded,
}: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Family[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<
    Record<string, StudentItem & { parentLabel: string }>
  >({});
  const [activeParent, setActiveParent] = useState<string>("");
  /** Famille épinglée : une fois un élève coché, seuls ce parent reste visible. */
  const [pinnedFamily, setPinnedFamily] = useState<Family | null>(null);
  const [searching, setSearching] = useState(false);

  const [internalSchoolYear, setInternalSchoolYear] = useState<string>("");
  const [schoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const isSchoolYearControlled = controlledSchoolYearId !== undefined;
  const schoolYear = isSchoolYearControlled
    ? controlledSchoolYearId
    : internalSchoolYear;

  const setSchoolYear = (next: string) => {
    if (!isSchoolYearControlled) {
      setInternalSchoolYear(next);
    }
    onSchoolYearIdChange?.(next);
  };
  const { data: session } = useSession();
  const peopleLabels = useBranchPeopleLabels();
  const pathname = usePathname();
  const branchIdFromPath = pathname.match(/\/branches\/([^/]+)/)?.[1];
  const branchId =
    branchIdFromPath ??
    session?.branch?.id ??
    session?.session?.activeBranchId;
  const didMountRef = useRef(false);
  const searchRequestRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSchoolYearsLoadedRef = useRef(onSchoolYearsLoaded);
  onSchoolYearsLoadedRef.current = onSchoolYearsLoaded;

  const emitChange = (
    next: Partial<{
      parentId: string;
      classEnrollIds: string[];
      schoolYearId: string;
    }> = {},
  ) => {
    onChange({
      parentId: next.parentId ?? activeParent,
      classEnrollIds: next.classEnrollIds ?? selected,
      schoolYearId: next.schoolYearId ?? schoolYear,
    });
  };

  const runSearch = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setSearching(true);

    try {
      const data = await searchFamilyAction(trimmed);
      if (requestId !== searchRequestRef.current) return;
      setResults(data);
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const toggleStudent = (parentId: string, child: StudentItem, family: Family) => {
    const id = child.classEnrollId;
    const parentLabel = `${family.parent.prenom} ${family.parent.nom}`.trim();

    let updated: string[];
    let nextDetails = { ...selectedDetails };

    if (selected.includes(id)) {
      updated = selected.filter((s) => s !== id);
      delete nextDetails[id];
    } else if (activeParent && activeParent !== parentId) {
      // Changement de parent : ne garder que le nouvel élève
      updated = [id];
      nextDetails = { [id]: { ...child, parentLabel } };
    } else {
      updated = [...selected, id];
      nextDetails[id] = { ...child, parentLabel };
    }

    const nextParentId = updated.length === 0 ? "" : parentId;

    setSelected(updated);
    setSelectedDetails(nextDetails);
    setActiveParent(nextParentId);
    setPinnedFamily(updated.length === 0 ? null : family);

    emitChange({
      parentId: nextParentId,
      classEnrollIds: updated,
    });
  };

  const selectAll = (family: Family) => {
    const studentsForYear = family.students.filter(
      (s) => s.schoolYearId === schoolYear,
    );
    const ids = studentsForYear.map((s) => s.classEnrollId);
    const parentLabel = `${family.parent.prenom} ${family.parent.nom}`.trim();
    const nextDetails: Record<string, StudentItem & { parentLabel: string }> =
      {};

    for (const student of studentsForYear) {
      nextDetails[student.classEnrollId] = { ...student, parentLabel };
    }

    setSelected(ids);
    setSelectedDetails(nextDetails);
    setActiveParent(family.parent.id);
    setPinnedFamily(family);

    emitChange({
      parentId: family.parent.id,
      classEnrollIds: ids,
    });
  };

  const clearAll = () => {
    setSelected([]);
    setSelectedDetails({});
    setActiveParent("");
    setPinnedFamily(null);

    emitChange({
      parentId: "",
      classEnrollIds: [],
    });
  };

  const removeStudent = (classEnrollId: string) => {
    const updated = selected.filter((id) => id !== classEnrollId);
    const nextDetails = { ...selectedDetails };
    delete nextDetails[classEnrollId];

    setSelected(updated);
    setSelectedDetails(nextDetails);

    if (updated.length === 0) {
      setActiveParent("");
      setPinnedFamily(null);
    }

    emitChange({
      parentId: updated.length === 0 ? "" : activeParent,
      classEnrollIds: updated,
    });
  };

  const selectedStudents = useMemo(
    () => Object.values(selectedDetails),
    [selectedDetails],
  );

  /** Avec une sélection active : n'afficher que le parent sélectionné. */
  const displayedResults = useMemo(() => {
    if (!activeParent || selected.length === 0) return results;

    const fromSearch = results.find((family) => family.parent.id === activeParent);
    const family = fromSearch ?? pinnedFamily;
    return family && family.parent.id === activeParent ? [family] : [];
  }, [results, activeParent, selected.length, pinnedFamily]);

  useEffect(() => {
    const loadYears = async () => {
      if (!branchId) return;

      const [[yearsData, yearsError], [currentYear]] = await Promise.all([
        getSchoolYearsAction1({ branchId }),
        getCurrentSchoolYearAction(),
      ]);

      if (yearsError || !yearsData) return;

      setSchoolYears(yearsData);
      onSchoolYearsLoadedRef.current?.(yearsData);

      const resolvedYear =
        currentYear?.id ??
        yearsData.find((y) => y.isCurrentYear)?.id ??
        yearsData[0]?.id ??
        "";

      setSchoolYear(resolvedYear);

      if (resolvedYear) {
        onChangeRef.current({
          parentId: "",
          classEnrollIds: [],
          schoolYearId: resolvedYear,
        });
      }
    };

    void loadYears();
  }, [branchId]);

  useEffect(() => {
    if (!schoolYear) return;

    emitChange({ schoolYearId: schoolYear });
  }, [schoolYear]);

  useEffect(() => {
    if (resetKey === undefined) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    setSearch("");
    setResults([]);
    setSelected([]);
    setSelectedDetails({});
    setActiveParent("");
    setPinnedFamily(null);
    setSearching(false);

    emitChange({
      parentId: "",
      classEnrollIds: [],
      schoolYearId: schoolYear,
    });
  }, [resetKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <label htmlFor="student-search" className="text-sm font-medium">
          {peopleLabels.searchLabel}
        </label>
        <Input
          id="student-search"
          placeholder={`Nom, prénom ou postnom de ${peopleLabels.studentDefinite} ou du parent…`}
          className="h-10 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startIcon={<Search className="h-4 w-4" />}
          endIcon={
            searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : undefined
          }
        />
        <p className="text-xs text-muted-foreground">
          Saisissez au moins 2 caractères pour lancer la recherche.
        </p>
      </div>

      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center gap-2",
          hideSchoolYearSelect && "lg:hidden",
        )}
      >
        <span className="text-sm text-muted-foreground shrink-0">
          Année scolaire
        </span>
        <Select
          value={schoolYear || undefined}
          onValueChange={setSchoolYear}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
            <SelectValue placeholder="Année scolaire" />
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.nameYear}
                {year.isCurrentYear ? " (en cours)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedStudents.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {peopleLabels.studentPlural} sélectionnés ({selectedStudents.length})
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Tout effacer
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedStudents.map((student) => (
              <Badge
                key={student.classEnrollId}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {student.prenom} {student.nom} ({student.codeClasse})
                <button
                  type="button"
                  onClick={() => removeStudent(student.classEnrollId)}
                  className="rounded-sm hover:bg-background/80 p-0.5"
                  aria-label={`Retirer ${student.prenom} ${student.nom}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 min-h-[120px]">
        {search.trim().length > 0 && search.trim().length < 2 && (
          <p className="text-sm text-muted-foreground">
            Continuez à saisir pour rechercher…
          </p>
        )}

        {search.trim().length >= 2 &&
          !searching &&
          displayedResults.length === 0 &&
          results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun {peopleLabels.studentLower} ou parent trouvé pour « {search.trim()} ».
          </p>
        )}

        {displayedResults.map((family) => {
          const studentsForYear = family.students.filter(
            (child) => child.schoolYearId === schoolYear,
          );

          if (studentsForYear.length === 0) return null;

          return (
            <div
              key={family.parent.id}
              className="border rounded-lg p-4 shadow-sm"
            >
              <div className="flex justify-between items-center font-medium mb-3 gap-2">
                <span className="text-sm">
                  {family.parent.prenom} {family.parent.nom}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    — parent / tuteur
                  </span>
                </span>

                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => selectAll(family)}
                    className="p-1.5 rounded hover:bg-green-50 text-green-600"
                    title="Tout sélectionner"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500"
                    title="Effacer la sélection"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {studentsForYear.map((child) => {
                  const checked = selected.includes(child.classEnrollId);

                  return (
                    <label
                      key={child.classEnrollId}
                      className={cn(
                        "flex items-center gap-3 text-sm p-2.5 rounded-md cursor-pointer transition-colors",
                        checked
                          ? "bg-primary/5 border border-primary/20"
                          : "hover:bg-muted/50 border border-transparent",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleStudent(family.parent.id, child, family)
                        }
                        className="h-4 w-4"
                      />

                      <span className="flex-1 min-w-0">
                        <span className="font-medium">
                          {child.prenom} {child.nom}
                          {child.postnom ? ` ${child.postnom}` : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {child.codeClasse || child.classeName}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
