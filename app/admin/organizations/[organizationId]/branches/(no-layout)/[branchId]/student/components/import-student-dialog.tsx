"use client";

import { useCallback, useEffect, useState } from "react";
import { IconSearch, IconUserPlus } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  searchOrganizationStudentsForImport,
} from "../../brevets/brevet.action";
import type { ImportSearchResult } from "@/lib/extended-student-import";
import type { PeopleLabels } from "@/lib/people-labels";
import { DEFAULT_PEOPLE_LABELS } from "@/lib/people-labels";

type ImportScope = "school_only" | "organization";
type ImportEnrollmentMode = "university" | "centre";

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
  }>;
  schoolYear: { id: string; nameYear: string };
};

const IMPORT_COPY: Record<
  ImportScope,
  { title: string; description: string; emptyMessage: string; alreadyLinked: string }
> = {
  school_only: {
    title: "Importer un eleve scolaire",
    description:
      "Recherchez un eleve inscrit dans une branche primaire ou secondaire de la meme organisation.",
    emptyMessage: "Aucun eleve scolaire trouve.",
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
  ImportEnrollmentMode,
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

export function ImportStudentDialog({
  open,
  onOpenChange,
  onSuccess,
  importScope = "school_only",
  requiresAuditoireOnImport = false,
  importEnrollmentMode = requiresAuditoireOnImport ? "university" : null,
  peopleLabels = DEFAULT_PEOPLE_LABELS,
}: ImportStudentDialogProps) {
  const copy =
    importScope === "organization"
      ? buildOrganizationImportCopy(peopleLabels)
      : IMPORT_COPY[importScope];
  const enrollmentUi = importEnrollmentMode
    ? ENROLLMENT_UI[importEnrollmentMode]
    : null;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [results, setResults] = useState<ImportSearchResult[]>([]);
  const [enrollmentOptions, setEnrollmentOptions] =
    useState<ImportEnrollmentOptions | null>(null);
  const [loadingEnrollmentOptions, setLoadingEnrollmentOptions] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const filteredSessions =
    enrollmentOptions?.sessions.filter(
      (session) => session.optionId === selectedModuleId,
    ) ?? [];

  const canImport =
    !importEnrollmentMode ||
    Boolean(selectedModuleId && selectedSessionId && enrollmentOptions);

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
      setEnrollmentOptions(null);
      setSelectedModuleId("");
      setSelectedSessionId("");
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

  async function handleImport(student: ImportSearchResult) {
    if (student.alreadyLinked) {
      toast.info(copy.alreadyLinked);
      return;
    }

    if (!canImport) {
      toast.error(
        enrollmentUi?.validationError ??
          "Selectionnez le contexte pedagogique avant l'import",
      );
      return;
    }

    setLinkingId(student.id);
    try {
      const result = await linkStudentToBranchAction({
        studentId: student.id,
        sourceBranchId: student.sourceBranchId,
        classeId: importEnrollmentMode ? selectedSessionId : undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {enrollmentUi
              ? enrollmentUi.description(peopleLabels)
              : copy.description}
          </DialogDescription>
        </DialogHeader>

        {importEnrollmentMode && enrollmentUi ? (
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
            ? results.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {student.nom} {student.postnom} {student.prenom}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {student.username} · {student.sourceBranchName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <BranchTypeBadge typebranch={student.sourceBranchType} />
                      {student.alreadyLinked ? (
                        <Badge variant="secondary">Deja importe</Badge>
                      ) : null}
                    </div>
                  </div>

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
                </div>
              ))
            : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
