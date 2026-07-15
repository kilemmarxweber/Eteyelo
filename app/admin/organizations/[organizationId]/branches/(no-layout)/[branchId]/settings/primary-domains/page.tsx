"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconBooks,
  IconCheck,
  IconDatabaseImport,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  PRIMARY_DOMAIN_LABELS,
  PRIMARY_DOMAIN_ORDER,
  PRIMARY_DOMAIN_SHORT_LABELS,
  getCatalogPrimaryPlacement,
  type PrimaryDomainCode,
} from "@/lib/primary-domains";
import {
  ensurePrimaryDomainsAction,
  getPrimaryDomainsSettingsAction,
  importPrimaryCatalogCoursesAction,
  savePrimaryCourseDomainAction,
} from "../settings.action";

type CourseRow = {
  id: string;
  nameCours: string;
  codeCours: string;
  primaryDomain: PrimaryDomainCode | null;
  primarySection: string | null;
  domainOrder: number | null;
};

type FilterTab = "ALL" | "UNASSIGNED" | PrimaryDomainCode;

const DOMAIN_OPTIONS = PRIMARY_DOMAIN_ORDER.map((code) => ({
  code,
  short: PRIMARY_DOMAIN_SHORT_LABELS[code],
  full: PRIMARY_DOMAIN_LABELS[code],
}));

export default function PrimaryDomainsSettingsPage() {
  const [isPrimary, setIsPrimary] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("ALL");

  function load() {
    startTransition(async () => {
      try {
        const data = await getPrimaryDomainsSettingsAction();
        setIsPrimary(data.isPrimary);
        setCourses(data.courses as CourseRow[]);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Chargement impossible.",
        );
      } finally {
        setLoaded(true);
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const byDomain = Object.fromEntries(
      PRIMARY_DOMAIN_ORDER.map((code) => [code, 0]),
    ) as Record<PrimaryDomainCode, number>;
    let unassigned = 0;
    for (const course of courses) {
      if (!course.primaryDomain) {
        unassigned += 1;
        continue;
      }
      byDomain[course.primaryDomain] += 1;
    }
    return { byDomain, unassigned, total: courses.length };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter((course) => {
        if (tab === "UNASSIGNED") return !course.primaryDomain;
        if (tab !== "ALL") return course.primaryDomain === tab;
        return true;
      })
      .filter((course) => {
        if (!q) return true;
        return (
          course.nameCours.toLowerCase().includes(q) ||
          course.codeCours.toLowerCase().includes(q) ||
          (course.primarySection ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const domainA = a.primaryDomain
          ? PRIMARY_DOMAIN_ORDER.indexOf(a.primaryDomain)
          : 99;
        const domainB = b.primaryDomain
          ? PRIMARY_DOMAIN_ORDER.indexOf(b.primaryDomain)
          : 99;
        if (domainA !== domainB) return domainA - domainB;
        return (a.domainOrder ?? 999) - (b.domainOrder ?? 999) ||
          a.nameCours.localeCompare(b.nameCours, "fr");
      });
  }, [courses, query, tab]);

  function updateLocal(id: string, patch: Partial<CourseRow>) {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function persistCourse(course: CourseRow, patch: Partial<CourseRow>) {
    const next = { ...course, ...patch };
    updateLocal(course.id, patch);
    setSavingId(course.id);
    startTransition(async () => {
      try {
        const result = await savePrimaryCourseDomainAction({
          coursId: next.id,
          primaryDomain: next.primaryDomain,
          primarySection: next.primarySection,
          domainOrder: next.domainOrder,
        });
        if (!result.ok) {
          toast.error(result.message);
          load();
          return;
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Enregistrement impossible.",
        );
        load();
      } finally {
        setSavingId(null);
      }
    });
  }

  function assignDomain(course: CourseRow, domain: PrimaryDomainCode | null) {
    if (domain === course.primaryDomain) return;

    if (!domain) {
      persistCourse(course, {
        primaryDomain: null,
        primarySection: null,
        domainOrder: null,
      });
      return;
    }

    const catalog = getCatalogPrimaryPlacement(course.nameCours);
    const useCatalogDefaults = catalog.domain === domain;
    persistCourse(course, {
      primaryDomain: domain,
      primarySection: useCatalogDefaults
        ? catalog.section === "AUTRES" || catalog.section === "AUTRES COURS"
          ? course.primarySection
          : catalog.section
        : course.primarySection,
      domainOrder: useCatalogDefaults
        ? catalog.sortOrder
        : (course.domainOrder ?? catalog.sortOrder),
    });
  }

  function autoAssign() {
    startTransition(async () => {
      try {
        const result = await ensurePrimaryDomainsAction();
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        load();
        if (counts.unassigned > 0) setTab("ALL");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Affectation impossible.",
        );
      }
    });
  }

  function importCatalog() {
    startTransition(async () => {
      try {
        const result = await importPrimaryCatalogCoursesAction();
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        setTab("ALL");
        load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Import impossible.",
        );
      }
    });
  }

  if (loaded && !isPrimary) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Domaines primaire</h2>
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux branches de type primaire.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Domaines primaire</h2>
            <Badge variant="outline-primary" icon={<IconBooks size={14} />}>
              Bulletin
            </Badge>
          </div>
          <p className="max-w-7xl text-sm text-muted-foreground">
            Les 5 domaines RDC sont fixes. Utilisez « Importer catalogue RDC » pour
            créer en base tous les cours officiels (classés par domaine), ou
            attribuez manuellement ci-dessous.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={importCatalog}
            disabled={pending}
            className="shrink-0"
          >
            <IconDatabaseImport className="mr-2 size-4" />
            Importer catalogue RDC
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={autoAssign}
            disabled={pending}
            className="shrink-0"
          >
            <IconRefresh className="mr-2 size-4" />
            Classer les non classés
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DOMAIN_OPTIONS.map(({ code, short, full }) => (
          <button
            key={code}
            type="button"
            onClick={() => setTab(code)}
            className={cn(
              "rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40",
              tab === code && "border-primary ring-1 ring-primary/30",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{short}</p>
              <Badge variant="secondary">{counts.byDomain[code]}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{full}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab("UNASSIGNED")}
          className={cn(
            "rounded-xl border border-dashed bg-card p-3 text-left transition-colors hover:bg-muted/40",
            tab === "UNASSIGNED" && "border-primary ring-1 ring-primary/30",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Non classés</p>
            <Badge variant={counts.unassigned > 0 ? "warning" : "secondary"}>
              {counts.unassigned}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cours sans domaine — utilisez le bouton « domaines par défaut ».
          </p>
        </button>
      </div>

      <Card>
        <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Cours de la branche</CardTitle>
            <CardDescription>
              {counts.total} cours · le regroupement se fait via les cartes domaine
              ci-dessus ; changez le domaine dans la liste — enregistrement immédiat.
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un cours…"
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as FilterTab)}
          >
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="ALL">Tous ({counts.total})</TabsTrigger>
              <TabsTrigger value="UNASSIGNED">
                Non classés ({counts.unassigned})
              </TabsTrigger>
              {DOMAIN_OPTIONS.map(({ code, short }) => (
                <TabsTrigger key={code} value={code}>
                  {short} ({counts.byDomain[code]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Liste hors TabsContent : Radix masque sinon le panneau (hidden) */}
          <div className="space-y-2">
            {!loaded || (pending && courses.length === 0) ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : filteredCourses.length === 0 ? (
              <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {courses.length === 0
                    ? "Aucun cours trouvé pour cette branche. Créez un cours ou vérifiez la branche active."
                    : "Aucun cours dans ce filtre."}
                </p>
                {courses.length === 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={load}>
                    <IconRefresh className="mr-2 size-4" />
                    Recharger
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y rounded-xl border bg-background">
                {filteredCourses.map((course) => {
                  const suggested = getCatalogPrimaryPlacement(course.nameCours);
                  const isSaving = savingId === course.id;
                  return (
                    <li
                      key={course.id}
                      className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(12rem,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {course.nameCours}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {course.codeCours || "Sans code"}
                          {suggested.domain &&
                          course.primaryDomain !== suggested.domain
                            ? ` · suggéré : ${PRIMARY_DOMAIN_SHORT_LABELS[suggested.domain]}`
                            : ""}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Domaine
                        </label>
                        <Select
                          value={course.primaryDomain ?? "NONE"}
                          onValueChange={(value) =>
                            assignDomain(
                              course,
                              value === "NONE"
                                ? null
                                : (value as PrimaryDomainCode),
                            )
                          }
                          disabled={pending && isSaving}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un domaine" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Non classé</SelectItem>
                            {DOMAIN_OPTIONS.map(({ code, short }) => (
                              <SelectItem key={code} value={code}>
                                {short}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-end pt-5 sm:pt-0">
                        {isSaving ? (
                          <span className="text-xs text-muted-foreground">…</span>
                        ) : course.primaryDomain ? (
                          <IconCheck
                            className="size-4 shrink-0 text-emerald-600"
                            aria-label="Enregistré"
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
