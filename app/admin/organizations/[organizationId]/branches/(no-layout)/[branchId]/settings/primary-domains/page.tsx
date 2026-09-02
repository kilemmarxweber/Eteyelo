"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconBooks,
  IconCheck,
  IconPencil,
  IconPlus,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getCatalogPrimaryPlacement } from "@/lib/primary-domains";
import {
  ensurePrimaryDomainsAction,
  getPrimaryDomainsSettingsAction,
  savePrimaryCourseDomainAction,
} from "../settings.action";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import { PrimaryCourseForm } from "./primary-course-form";
import { PrimaryDomainForm } from "./primary-domain-form";

type DomainRow = {
  id: string;
  code: string;
  label: string;
  shortLabel: string;
  sortOrder: number;
  isSystem: boolean;
};

type CourseRow = {
  id: string;
  nameCours: string;
  codeCours: string;
  description: string;
  primaryDomain: string | null;
  primarySection: string | null;
  domainOrder: number | null;
};

type FilterTab = "ALL" | "UNASSIGNED" | string;

const COURSES_PAGE_SIZE = 10;

export default function PrimaryDomainsSettingsPage() {
  const [isPrimary, setIsPrimary] = useState(false);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [page, setPage] = useState(1);
  const [openCreateCourse, setOpenCreateCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null);
  const [openCreateDomain, setOpenCreateDomain] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainRow | null>(null);

  function load() {
    startTransition(async () => {
      try {
        const data = await getPrimaryDomainsSettingsAction();
        setIsPrimary(data.isPrimary);
        setDomains(data.domains as DomainRow[]);
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

  const domainByCode = useMemo(() => {
    const map = new Map<string, DomainRow>();
    for (const d of domains) map.set(d.code, d);
    return map;
  }, [domains]);

  const counts = useMemo(() => {
    const byDomain: Record<string, number> = {};
    for (const d of domains) byDomain[d.code] = 0;
    let unassigned = 0;
    for (const course of courses) {
      if (!course.primaryDomain) {
        unassigned += 1;
        continue;
      }
      byDomain[course.primaryDomain] = (byDomain[course.primaryDomain] ?? 0) + 1;
    }
    return { byDomain, unassigned, total: courses.length };
  }, [courses, domains]);

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter((c) => {
        if (tab === "UNASSIGNED") return !c.primaryDomain;
        if (tab !== "ALL") return c.primaryDomain === tab;
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        return (
          c.nameCours.toLowerCase().includes(q) ||
          c.codeCours.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const domainA = a.primaryDomain
          ? (domainByCode.get(a.primaryDomain)?.sortOrder ?? 999)
          : 9999;
        const domainB = b.primaryDomain
          ? (domainByCode.get(b.primaryDomain)?.sortOrder ?? 999)
          : 9999;
        if (domainA !== domainB) return domainA - domainB;
        return (
          (a.domainOrder ?? 999) - (b.domainOrder ?? 999) ||
          a.nameCours.localeCompare(b.nameCours, "fr")
        );
      });
  }, [courses, domainByCode, query, tab]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCourses.length / COURSES_PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pagedCourses = useMemo(() => {
    const start = (currentPage - 1) * COURSES_PAGE_SIZE;
    return filteredCourses.slice(start, start + COURSES_PAGE_SIZE);
  }, [currentPage, filteredCourses]);

  useEffect(() => {
    setPage(1);
  }, [query, tab]);

  function handleSaved() {
    setOpenCreateCourse(false);
    setEditingCourse(null);
    setOpenCreateDomain(false);
    setEditingDomain(null);
    load();
  }

  function assignDomain(course: CourseRow, domain: string | null) {
    if (domain === course.primaryDomain) return;
    const next: CourseRow = !domain
      ? {
          ...course,
          primaryDomain: null,
          primarySection: null,
          domainOrder: null,
        }
      : (() => {
          const catalog = getCatalogPrimaryPlacement(course.nameCours);
          const useCatalogDefaults = catalog.domain === domain;
          return {
            ...course,
            primaryDomain: domain,
            primarySection: useCatalogDefaults
              ? catalog.section === "AUTRES" ||
                catalog.section === "AUTRES COURS"
                ? null
                : catalog.section
              : null,
            domainOrder: useCatalogDefaults
              ? catalog.sortOrder
              : (course.domainOrder ??
                domainByCode.get(domain)?.sortOrder ??
                500),
          };
        })();

    setCourses((prev) => prev.map((c) => (c.id === course.id ? next : c)));
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
        toast.success(result.message);
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
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Classement impossible.",
        );
      }
    });
  }

  if (loaded && !isPrimary) {
    return (
      <RequireBranchOrgSettingsAccess>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Domaines primaire</h2>
          <p className="text-sm text-muted-foreground">
            Cette page est réservée aux branches de type primaire.
          </p>
        </div>
      </RequireBranchOrgSettingsAccess>
    );
  }

  return (
    <RequireBranchOrgSettingsAccess>
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
              Créez ou renommez les domaines (Langues, Arts…), puis classez les
              cours.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={() => setOpenCreateDomain(true)}>
              <IconPlus className="mr-2 size-4" />
              Ajouter un domaine
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpenCreateCourse(true)}
            >
              <IconPlus className="mr-2 size-4" />
              Ajouter un cours
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={autoAssign}
              disabled={pending}
            >
              <IconRefresh className="mr-2 size-4" />
              Classer les non classés
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Domaines</CardTitle>
              <CardDescription>
                Libellés affichés sur le bulletin. Les domaines système RDC
                peuvent être renommés.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border bg-background">
              {domains.map((domain) => (
                <li
                  key={domain.id}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{domain.shortLabel}</p>
                      {domain.isSystem ? (
                        <Badge variant="secondary">RDC</Badge>
                      ) : (
                        <Badge variant="outline">Personnalisé</Badge>
                      )}
                      <Badge variant="secondary">
                        {counts.byDomain[domain.code] ?? 0} cours
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {domain.label}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingDomain(domain)}
                  >
                    <IconPencil className="mr-1 size-4" />
                    Modifier
                  </Button>
                </li>
              ))}
              {domains.length === 0 && loaded ? (
                <li className="p-4 text-center text-sm text-muted-foreground">
                  Aucun domaine — cliquez sur « Ajouter un domaine ».
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {domains.map((domain) => (
            <button
              key={domain.code}
              type="button"
              onClick={() => setTab(domain.code)}
              className={cn(
                "rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40",
                tab === domain.code && "border-primary ring-1 ring-primary/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{domain.shortLabel}</p>
                <Badge variant="secondary">
                  {counts.byDomain[domain.code] ?? 0}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {domain.label}
              </p>
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
              Cours sans domaine — utilisez « Classer les non classés ».
            </p>
          </button>
        </div>

        <Card>
          <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Cours de la branche</CardTitle>
              <CardDescription>
                {counts.total} cours · changez le domaine dans la liste ou ouvrez
                Modifier pour le détail.
              </CardDescription>
            </div>
            <div className="relative w-full min-w-0 max-w-5xl">
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
                {domains.map((domain) => (
                  <TabsTrigger key={domain.code} value={domain.code}>
                    {domain.shortLabel} ({counts.byDomain[domain.code] ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="space-y-2">
              {!loaded || (pending && courses.length === 0) ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : filteredCourses.length === 0 ? (
                <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {courses.length === 0
                      ? "Aucun cours. Ajoutez un cours pour commencer."
                      : "Aucun cours dans ce filtre."}
                  </p>
                  {courses.length === 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setOpenCreateCourse(true)}
                    >
                      <IconPlus className="mr-2 size-4" />
                      Ajouter un cours
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <ul className="divide-y rounded-xl border bg-background">
                    {pagedCourses.map((course) => {
                      const suggested = getCatalogPrimaryPlacement(
                        course.nameCours,
                      );
                      const isSaving = savingId === course.id;
                      const suggestedLabel =
                        domainByCode.get(suggested.domain)?.shortLabel ??
                        suggested.domain;
                      return (
                        <li
                          key={course.id}
                          className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(11rem,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {course.nameCours}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {course.codeCours || "Sans code"}
                              {suggested.domain &&
                              course.primaryDomain !== suggested.domain
                                ? ` · suggéré : ${suggestedLabel}`
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
                                  value === "NONE" ? null : value,
                                )
                              }
                              disabled={pending && isSaving}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir un domaine" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">Non classé</SelectItem>
                                {domains.map((domain) => (
                                  <SelectItem
                                    key={domain.code}
                                    value={domain.code}
                                  >
                                    {domain.shortLabel}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-5 sm:pt-0">
                            {isSaving ? (
                              <span className="text-xs text-muted-foreground">
                                …
                              </span>
                            ) : course.primaryDomain ? (
                              <IconCheck
                                className="size-4 shrink-0 text-emerald-600"
                                aria-label="Enregistré"
                              />
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCourse(course)}
                            >
                              <IconPencil className="mr-1 size-4" />
                              Modifier
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {filteredCourses.length > COURSES_PAGE_SIZE ? (
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {(currentPage - 1) * COURSES_PAGE_SIZE + 1}–
                        {Math.min(
                          currentPage * COURSES_PAGE_SIZE,
                          filteredCourses.length,
                        )}{" "}
                        sur {filteredCourses.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Précédent
                        </Button>
                        <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={currentPage >= totalPages}
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                        >
                          Suivant
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Sheet open={openCreateDomain} onOpenChange={setOpenCreateDomain}>
          <SheetContent
            side="right"
            className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          >
            <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
              <SheetTitle>Ajouter un domaine</SheetTitle>
              <SheetDescription>
                Ex. Langues, Arts — le libellé bulletin apparaît sur le bulletin.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <PrimaryDomainForm mode="create" onSaved={handleSaved} />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet
          open={Boolean(editingDomain)}
          onOpenChange={(open) => !open && setEditingDomain(null)}
        >
          <SheetContent
            side="right"
            className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          >
            <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
              <SheetTitle>Modifier le domaine</SheetTitle>
              <SheetDescription>
                Mettez à jour le nom court ou le libellé bulletin.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {editingDomain ? (
                <PrimaryDomainForm
                  mode="update"
                  initialData={{
                    id: editingDomain.id,
                    shortLabel: editingDomain.shortLabel,
                    label: editingDomain.label,
                    sortOrder: editingDomain.sortOrder,
                  }}
                  onSaved={handleSaved}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={openCreateCourse} onOpenChange={setOpenCreateCourse}>
          <SheetContent
            side="right"
            className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          >
            <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
              <SheetTitle>Ajouter un cours</SheetTitle>
              <SheetDescription>
                Créez un cours et attribuez-lui un domaine du bulletin.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <PrimaryCourseForm
                mode="create"
                domains={domains}
                onCreated={handleSaved}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet
          open={Boolean(editingCourse)}
          onOpenChange={(open) => !open && setEditingCourse(null)}
        >
          <SheetContent
            side="right"
            className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          >
            <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
              <SheetTitle>Modifier le cours</SheetTitle>
              <SheetDescription>
                Mettez à jour le nom, la description ou le domaine.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {editingCourse ? (
                <PrimaryCourseForm
                  mode="update"
                  domains={domains}
                  initialData={{
                    id: editingCourse.id,
                    nameCours: editingCourse.nameCours,
                    description: editingCourse.description,
                    primaryDomain: editingCourse.primaryDomain,
                  }}
                  onUpdated={handleSaved}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
