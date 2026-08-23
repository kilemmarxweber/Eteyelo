"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { searchFamilyAction, Family, StudentItem } from "../paiement.action";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentSchoolYearAction, getSchoolYearsAction1 } from "../../schoolYear/schoolYear.action";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

const PAIEMENT_BOOTSTRAP_TTL_MS = 5 * 60 * 1000;

function readPaiementBootstrap(
  branchId: string | undefined,
  options?: { consume?: boolean },
): {
  q: string;
  enrollmentId: string;
} {
  if (typeof window === "undefined") {
    return { q: "", enrollmentId: "" };
  }

  const fromUrl = new URLSearchParams(window.location.search);
  const urlQ = (fromUrl.get("q") ?? "").trim();
  const urlEnrollmentId = (fromUrl.get("enrollmentId") ?? "").trim();

  let storageQ = "";
  let storageEnrollmentId = "";
  if (branchId) {
    try {
      const key = `eteyelo:paiement-bootstrap:${branchId}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          q?: string;
          enrollmentId?: string;
          at?: number;
        };
        const fresh =
          typeof parsed.at === "number" &&
          Date.now() - parsed.at < PAIEMENT_BOOTSTRAP_TTL_MS;
        if (fresh) {
          storageQ = (parsed.q ?? "").trim();
          storageEnrollmentId = (parsed.enrollmentId ?? "").trim();
        }
        if (options?.consume) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    q: urlQ || storageQ,
    enrollmentId: urlEnrollmentId || storageEnrollmentId,
  };
}

interface Props {
  onChange: (data: {
    parentId: string;
    classEnrollIds: string[];
    schoolYearId: string;
  }) => void;
  resetKey?: number;
  /** Masque le sélecteur d'année (affiché ailleurs, ex. panneau gauche). */
  hideSchoolYearSelect?: boolean;
  /** Préremplit la recherche (ex. après inscription). */
  initialSearch?: string;
  /** Pré-coche l'inscription (ex. après inscription). */
  initialEnrollmentId?: string;
  /** Contrôle externe de l'année scolaire. */
  schoolYearId?: string;
  onSchoolYearIdChange?: (schoolYearId: string) => void;
  onSchoolYearsLoaded?: (years: ISchoolYear[]) => void;
}

export default function FamilySelector({
  onChange,
  resetKey,
  hideSchoolYearSelect = false,
  initialSearch = "",
  initialEnrollmentId = "",
  schoolYearId: controlledSchoolYearId,
  onSchoolYearIdChange,
  onSchoolYearsLoaded,
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const branchIdFromPath = pathname.match(/\/branches\/([^/]+)/)?.[1];
  const { data: session } = useSession();
  const branchId =
    branchIdFromPath ??
    session?.branch?.id ??
    session?.session?.activeBranchId;

  const querySearch = (searchParams.get("q") ?? "").trim();
  const queryEnrollmentId = (searchParams.get("enrollmentId") ?? "").trim();

  const [bootstrap] = useState(() => {
    const fromWindow = readPaiementBootstrap(branchIdFromPath);
    return {
      q: (fromWindow.q || querySearch || initialSearch).trim(),
      enrollmentId: (
        fromWindow.enrollmentId ||
        queryEnrollmentId ||
        initialEnrollmentId
      ).trim(),
    };
  });

  const bootstrapSearch = (
    bootstrap.q ||
    querySearch ||
    initialSearch
  ).trim();
  const bootstrapEnrollmentId = (
    bootstrap.enrollmentId ||
    queryEnrollmentId ||
    initialEnrollmentId
  ).trim();

  const [search, setSearch] = useState(() => bootstrapSearch);
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
  const peopleLabels = useBranchPeopleLabels();
  const didMountRef = useRef(false);
  const searchRequestRef = useRef(0);
  const autoSelectedRef = useRef(false);
  const bootstrappedSearchRef = useRef(false);
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

  useLayoutEffect(() => {
    if (bootstrappedSearchRef.current) return;
    const fromWindow = readPaiementBootstrap(branchIdFromPath, {
      consume: true,
    });
    const next = (
      fromWindow.q ||
      querySearch ||
      initialSearch ||
      bootstrap.q
    ).trim();
    if (!next) return;
    bootstrappedSearchRef.current = true;
    setSearch(next);
  }, [
    branchIdFromPath,
    querySearch,
    initialSearch,
    bootstrap.q,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(search);
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (!bootstrapEnrollmentId || !results.length) return;

    for (const family of results) {
      const child = family.students.find((s) => {
        if (s.classEnrollId !== bootstrapEnrollmentId) return false;
        if (schoolYear && s.schoolYearId && s.schoolYearId !== schoolYear) {
          return false;
        }
        return true;
      });
      if (!child) continue;

      autoSelectedRef.current = true;
      const parentLabel = `${family.parent.prenom} ${family.parent.nom}`.trim();
      setSelected([child.classEnrollId]);
      setSelectedDetails({
        [child.classEnrollId]: { ...child, parentLabel },
      });
      setActiveParent(family.parent.id);
      setPinnedFamily(family);
      onChangeRef.current({
        parentId: family.parent.id,
        classEnrollIds: [child.classEnrollId],
        schoolYearId: schoolYear,
      });
      break;
    }
  }, [results, schoolYear, bootstrapEnrollmentId]);

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
    autoSelectedRef.current = false;

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
          Rechercher un {peopleLabels.studentLower} ou son tuteur
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
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
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
      )}

      <div
        className={cn(
          "min-h-[120px] gap-3",
          displayedResults.length >= 2
            ? "grid grid-cols-1 sm:grid-cols-2"
            : "flex flex-col",
        )}
      >
        {search.trim().length > 0 && search.trim().length < 2 && (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Continuez à saisir pour rechercher…
          </p>
        )}

        {search.trim().length >= 2 &&
          !searching &&
          displayedResults.length === 0 &&
          results.length === 0 && (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Aucun {peopleLabels.studentLower} ou parent trouvé pour « {search.trim()} ».
          </p>
        )}

        {displayedResults.map((family) => {
          const studentsForYear = schoolYear
            ? family.students.filter(
                (child) => child.schoolYearId === schoolYear,
              )
            : family.students;

          if (studentsForYear.length === 0) return null;

          return (
            <div
              key={family.parent.id}
              className="rounded-lg border p-2.5 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2 font-medium">
                <span className="truncate text-xs sm:text-sm">
                  {family.parent.prenom} {family.parent.nom}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    — parent / tuteur
                  </span>
                </span>

                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => selectAll(family)}
                    className="rounded p-1 text-green-600 hover:bg-green-50"
                    title="Tout sélectionner"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    title="Effacer la sélection"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  "gap-1.5",
                  studentsForYear.length >= 2
                    ? "grid grid-cols-1 sm:grid-cols-2"
                    : "flex flex-col",
                )}
              >
                {studentsForYear.map((child) => {
                  const checked = selected.includes(child.classEnrollId);
                  const fullName = [
                    child.prenom,
                    child.nom,
                    child.postnom,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <label
                      key={child.classEnrollId}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                        checked
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/70 hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleStudent(family.parent.id, child, family)
                        }
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{fullName}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {child.codeClasse || child.classeName}
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
