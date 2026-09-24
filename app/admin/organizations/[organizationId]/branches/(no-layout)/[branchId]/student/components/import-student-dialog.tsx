"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconSearch, IconUserPlus, IconUsersGroup } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BranchTypeBadge } from "@/components/branch/branch-type-badge";
import {
  getImportEnrollmentOptionsAction,
  linkStudentToBranchAction,
  linkStudentsToBranchAction,
  searchOrganizationStudentsForImport,
} from "../../brevets/brevet.action";
import type { ImportSearchResult } from "@/lib/extended-student-import";
import type { PeopleLabels } from "@/lib/people-labels";
import { DEFAULT_PEOPLE_LABELS } from "@/lib/people-labels";
import { cn } from "@/lib/utils";

type ImportScope = "school_only" | "organization";
type ImportEnrollmentMode = "university" | "centre" | "atelier";

type ImportStudentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  importScope?: ImportScope;
  /** @deprecated Utiliser importEnrollmentMode */
  requiresAuditoireOnImport?: boolean;
  importEnrollmentMode?: ImportEnrollmentMode | null;
  peopleLabels?: PeopleLabels;
};

type ImportEnrollmentOptions = {
  mode: ImportEnrollmentMode;
  modules: Array<{
    id: string;
    nameOption: string;
    sectionName: string | null;
  }>;
  sessions: Array<{
    id: string;
    nameClasse: string;
    optionId: string;
    optionName: string;
    enrolledCount?: number;
    capacity?: number | null;
  }>;
  groupes?: Array<{
    id: string;
    nameClasse: string;
    optionName: string;
    enrolledCount: number;
    capacity: number | null;
  }>;
  schoolYear: { id: string; nameYear: string };
};

const IMPORT_COPY: Record<
  ImportScope,
  { title: string; description: string; emptyMessage: string; alreadyLinked: string }
> = {
  school_only: {
    title: "Importer un eleve des humanites",
    description:
      "Recherchez un eleve inscrit en humanites (pas le tronc commun, le primaire ni la maternelle).",
    emptyMessage: "Aucun eleve des humanites trouve.",
    alreadyLinked: "Cet eleve est deja present dans cette branche",
  },
  organization: {
    title: "Importer un apprenant",
    description:
      "Recherchez un apprenant inscrit dans une autre branche de la meme organisation.",
    emptyMessage: "Aucun apprenant trouve.",
    alreadyLinked: "Cet apprenant est deja lie a cette branche",
  },
};

const ENROLLMENT_UI: Record<
  Exclude<ImportEnrollmentMode, "atelier">,
  {
    description: (labels: PeopleLabels) => string;
    primaryLabel: string;
    secondaryLabel: string;
    primaryPlaceholder: string;
    secondaryPlaceholder: string;
    selectPrimaryFirst: string;
    noSecondary: string;
    validationError: string;
  }
> = {
  university: {
    description: (labels) =>
      `Selectionnez une filiere et un auditoire, puis importez l'${labels.studentLower} dans l'annee academique en cours.`,
    primaryLabel: "Filiere",
    secondaryLabel: "Auditoire",
    primaryPlaceholder: "Selectionner une filiere",
    secondaryPlaceholder: "Selectionner un auditoire",
    selectPrimaryFirst: "Choisissez d'abord une filiere",
    noSecondary: "Aucun auditoire pour cette filiere",
    validationError: "Selectionnez une filiere et un auditoire avant l'import",
  },
  centre: {
    description: (labels) =>
      `Selectionnez un module et une session, puis importez l'${labels.studentLower} dans l'annee academique en cours.`,
    primaryLabel: "Module",
    secondaryLabel: "Session",
    primaryPlaceholder: "Selectionner un module",
    secondaryPlaceholder: "Selectionner une session",
    selectPrimaryFirst: "Choisissez d'abord un module",
    noSecondary: "Aucune session pour ce module",
    validationError: "Selectionnez un module et une session avant l'import",
  },
};

function buildOrganizationImportCopy(labels: PeopleLabels) {
  const studentLower = labels.studentLower;

  return {
    title: `Importer un ${studentLower}`,
    description: `Recherchez un ${studentLower} inscrit dans une autre branche de la meme organisation.`,
    emptyMessage: `Aucun ${studentLower} trouve.`,
    alreadyLinked: `Ce ${studentLower} est deja lie a cette branche`,
  };
}

function formatGroupeCapacity(
  enrolledCount: number | undefined,
  capacity: number | null | undefined,
) {
  if (typeof enrolledCount !== "number") return null;
  if (capacity == null) return `${enrolledCount} inscrit(s)`;
  return `${enrolledCount}/${capacity}`;
}

export function ImportStudentDialog({
  open,
  onOpenChange,
  onSuccess,
  importScope = "school_only",
  requiresAuditoireOnImport = false,
  importEnrollmentMode = requiresAuditoireOnImport ? "university" : null,
  peopleLabels = DEFAULT_PEOPLE_LABELS,
}: ImportStudentDialogProps) {
  const isAtelier = importEnrollmentMode === "atelier";
  const copy = isAtelier
    ? {
        title: "Importer un lot d'eleves",
        description:
          "Choisissez d'abord le groupe de l'annee en cours, puis selectionnez un ou plusieurs eleves des humanites.",
        emptyMessage: "Aucun eleve des humanites trouve.",
        alreadyLinked: "Cet eleve est deja present dans cet atelier",
      }
    : importScope === "organization"
      ? buildOrganizationImportCopy(peopleLabels)
      : IMPORT_COPY[importScope];
  const enrollmentUi =
    importEnrollmentMode && importEnrollmentMode !== "atelier"
      ? ENROLLMENT_UI[importEnrollmentMode]
      : null;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const [results, setResults] = useState<ImportSearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrollmentOptions, setEnrollmentOptions] =
    useState<ImportEnrollmentOptions | null>(null);
  const [loadingEnrollmentOptions, setLoadingEnrollmentOptions] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedGroupeId, setSelectedGroupeId] = useState("");

  const filteredSessions =
    enrollmentOptions?.sessions.filter(
      (session) => session.optionId === selectedModuleId,
    ) ?? [];

  const importableResults = useMemo(
    () => results.filter((student) => !student.alreadyLinked),
    [results],
  );

  const selectedStudents = useMemo(
    () => importableResults.filter((student) => selectedIds.has(student.id)),
    [importableResults, selectedIds],
  );

  const selectedGroupe = enrollmentOptions?.groupes?.find(
    (groupe) => groupe.id === selectedGroupeId,
  );

  const canImport =
    isAtelier
      ? Boolean(selectedGroupeId && enrollmentOptions)
      : !importEnrollmentMode ||
        Boolean(selectedModuleId && selectedSessionId && enrollmentOptions);

  const allImportableSelected =
    importableResults.length > 0 &&
    importableResults.every((student) => selectedIds.has(student.id));

  const searchStudents = useCallback(async (value: string) => {
    setLoading(true);
    try {
      const response = await searchOrganizationStudentsForImport({
        query: value,
        limit: 30,
      });

      if (!response.ok) {
        toast.error(response.message);
        setResults([]);
        return;
      }

      setResults(response.students);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLinkingId(null);
      setBatchImporting(false);
      setSelectedIds(new Set());
      setEnrollmentOptions(null);
      setSelectedModuleId("");
      setSelectedSessionId("");
      setSelectedGroupeId("");
      return;
    }

    if (importEnrollmentMode) {
      setLoadingEnrollmentOptions(true);
      void getImportEnrollmentOptionsAction()
        .then((response) => {
          if (!response.ok) {
            toast.error(response.message);
            setEnrollmentOptions(null);
            return;
          }

          setEnrollmentOptions({
            mode: response.mode,
            modules: response.modules,
            sessions: response.sessions,
            groupes: "groupes" in response ? response.groupes : undefined,
            schoolYear: response.schoolYear,
          });
        })
        .finally(() => {
          setLoadingEnrollmentOptions(false);
        });
    }

    const timeout = window.setTimeout(() => {
      void searchStudents(query);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [open, query, importEnrollmentMode, searchStudents]);

  useEffect(() => {
    setSelectedSessionId("");
  }, [selectedModuleId]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (importableResults.some((student) => student.id === id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [importableResults]);

  function toggleStudent(studentId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }

  function toggleAllImportable(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(importableResults.map((student) => student.id)));
  }

  async function handleImport(student: ImportSearchResult) {
    if (student.alreadyLinked) {
      toast.info(copy.alreadyLinked);
      return;
    }

    if (!canImport) {
      toast.error(
        isAtelier
          ? "Selectionnez un groupe avant l'import"
          : (enrollmentUi?.validationError ??
            "Selectionnez le contexte pedagogique avant l'import"),
      );
      return;
    }

    setLinkingId(student.id);
    try {
      const result = await linkStudentToBranchAction({
        studentId: student.id,
        sourceBranchId: student.sourceBranchId,
        classeId: isAtelier
          ? selectedGroupeId
          : importEnrollmentMode
            ? selectedSessionId
            : undefined,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Import reussi");
      onSuccess();
      onOpenChange(false);
    } finally {
      setLinkingId(null);
    }
  }

  async function handleBatchImport() {
    if (!isAtelier) return;

    if (!selectedGroupeId) {
      toast.error("Selectionnez un groupe avant l'import");
      return;
    }

    if (selectedStudents.length === 0) {
      toast.error("Selectionnez au moins un eleve a importer");
      return;
    }

    setBatchImporting(true);
    try {
      const result = await linkStudentsToBranchAction({
        classeId: selectedGroupeId,
        students: selectedStudents.map((student) => ({
          studentId: student.id,
          sourceBranchId: student.sourceBranchId,
        })),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const failed = result.failures.length;
      if (failed > 0) {
        toast.warning(
          `${result.importedCount} importe(s), ${failed} echec(s)`,
        );
      } else {
        toast.success(
          `${result.importedCount} eleve(s) importe(s) dans ${selectedGroupe?.nameClasse ?? "le groupe"}`,
        );
      }
      onSuccess();
      onOpenChange(false);
    } finally {
      setBatchImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size={isAtelier ? "xl" : "lg"}
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <DialogHeader className="space-y-2 border-b px-6 py-5 text-left">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {isAtelier
              ? copy.description
              : enrollmentUi
                ? enrollmentUi.description(peopleLabels)
                : copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {isAtelier ? (
            <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <IconUsersGroup className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Groupe obligatoire</p>
                    <p className="text-xs text-muted-foreground">
                      Annee en cours
                      {enrollmentOptions
                        ? ` · ${enrollmentOptions.schoolYear.nameYear}`
                        : ""}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Visible en paiements</Badge>
              </div>
              <Select
                value={selectedGroupeId}
                onValueChange={setSelectedGroupeId}
                disabled={loadingEnrollmentOptions || !enrollmentOptions}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue
                    placeholder={
                      loadingEnrollmentOptions
                        ? "Chargement des groupes..."
                        : "Selectionner un groupe existant"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(enrollmentOptions?.groupes ?? []).map((groupe) => (
                    <SelectItem key={groupe.id} value={groupe.id}>
                      <span className="flex items-center gap-2">
                        <span>{groupe.nameClasse}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatGroupeCapacity(
                            groupe.enrolledCount,
                            groupe.capacity,
                          )}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedGroupeId ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  L&apos;import est bloque tant qu&apos;aucun groupe n&apos;est
                  selectionne.
                </p>
              ) : null}
            </div>
          ) : null}

          {importEnrollmentMode &&
          importEnrollmentMode !== "atelier" &&
          enrollmentUi ? (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">
                  {enrollmentUi.primaryLabel}
                </label>
                <Select
                  value={selectedModuleId}
                  onValueChange={setSelectedModuleId}
                  disabled={loadingEnrollmentOptions || !enrollmentOptions}
                >
                  <SelectTrigger className="mt-2 h-11 rounded-xl">
                    <SelectValue
                      placeholder={
                        loadingEnrollmentOptions
                          ? "Chargement..."
                          : enrollmentUi.primaryPlaceholder
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollmentOptions?.modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.nameOption}
                        {module.sectionName ? ` · ${module.sectionName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {enrollmentUi.secondaryLabel}
                </label>
                <Select
                  value={selectedSessionId}
                  onValueChange={setSelectedSessionId}
                  disabled={
                    loadingEnrollmentOptions ||
                    !selectedModuleId ||
                    filteredSessions.length === 0
                  }
                >
                  <SelectTrigger className="mt-2 h-11 rounded-xl">
                    <SelectValue
                      placeholder={
                        !selectedModuleId
                          ? enrollmentUi.selectPrimaryFirst
                          : filteredSessions.length === 0
                            ? enrollmentUi.noSecondary
                            : enrollmentUi.secondaryPlaceholder
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.nameClasse}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {enrollmentOptions ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Annee academique : {enrollmentOptions.schoolYear.nameYear}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, prenom ou matricule..."
              className="h-11 rounded-xl pl-9"
              autoFocus
            />
          </div>

          {isAtelier && importableResults.length > 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={
                    allImportableSelected ||
                    (selectedIds.size > 0 && "indeterminate")
                  }
                  onCheckedChange={(value) => toggleAllImportable(!!value)}
                  aria-label="Tout selectionner"
                />
                <span>
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selectionne(s)`
                    : "Tout selectionner"}
                </span>
              </label>
              <span className="text-xs text-muted-foreground">
                {importableResults.length} disponible(s)
              </span>
            </div>
          ) : null}

          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Recherche en cours...
              </p>
            ) : null}

            {!loading && results.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {copy.emptyMessage}
              </p>
            ) : null}

            {!loading
              ? results.map((student) => {
                  const selected = selectedIds.has(student.id);
                  const disabledRow =
                    student.alreadyLinked || batchImporting || linkingId !== null;

                  return (
                    <div
                      key={student.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors",
                        isAtelier &&
                          selected &&
                          !student.alreadyLinked &&
                          "border-primary/40 bg-primary/[0.03]",
                        isAtelier &&
                          !student.alreadyLinked &&
                          "cursor-pointer hover:bg-muted/40",
                      )}
                      onClick={() => {
                        if (!isAtelier || disabledRow || student.alreadyLinked) {
                          return;
                        }
                        toggleStudent(student.id, !selected);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {isAtelier ? (
                          <Checkbox
                            checked={student.alreadyLinked ? false : selected}
                            disabled={disabledRow}
                            onCheckedChange={(value) =>
                              toggleStudent(student.id, !!value)
                            }
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Selectionner ${student.nom}`}
                            className="mt-1"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {student.nom} {student.postnom} {student.prenom}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {student.username} · {student.sourceBranchName}
                          </p>
                          <p className="mt-1 text-xs text-foreground/80">
                            {[
                              student.optionName,
                              student.className ?? student.classCode,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Classe non renseignee"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <BranchTypeBadge
                              typebranch={student.sourceBranchType}
                            />
                            {student.alreadyLinked ? (
                              <Badge variant="secondary">Deja importe</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {!isAtelier ? (
                        <Button
                          size="sm"
                          leftSection={<IconUserPlus size={16} />}
                          loading={linkingId === student.id}
                          disabled={
                            student.alreadyLinked ||
                            linkingId !== null ||
                            !canImport
                          }
                          onClick={() => void handleImport(student)}
                        >
                          Importer
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        </div>

        {isAtelier ? (
          <DialogFooter className="gap-3 border-t bg-muted/20 px-6 py-4 sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedStudents.length > 0 && selectedGroupe
                ? `${selectedStudents.length} eleve(s) → ${selectedGroupe.nameClasse}`
                : selectedStudents.length > 0
                  ? `${selectedStudents.length} eleve(s) selectionne(s)`
                  : "Aucun eleve selectionne"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={batchImporting}
              >
                Annuler
              </Button>
              <Button
                leftSection={<IconUserPlus size={16} />}
                loading={batchImporting}
                disabled={
                  !canImport ||
                  selectedStudents.length === 0 ||
                  batchImporting
                }
                onClick={() => void handleBatchImport()}
              >
                Importer le lot
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
