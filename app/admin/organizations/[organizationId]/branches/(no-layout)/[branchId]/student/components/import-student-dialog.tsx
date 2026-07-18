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
  getUniversityImportEnrollmentOptionsAction,
  linkStudentToBranchAction,
  searchOrganizationStudentsForImport,
} from "../../brevets/brevet.action";
import type { ImportSearchResult } from "@/lib/extended-student-import";
import type { PeopleLabels } from "@/lib/people-labels";
import { DEFAULT_PEOPLE_LABELS } from "@/lib/people-labels";

type ImportScope = "school_only" | "organization";

type ImportStudentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  importScope?: ImportScope;
  requiresAuditoireOnImport?: boolean;
  peopleLabels?: PeopleLabels;
};

type UniversityEnrollmentOption = {
  filieres: Array<{
    id: string;
    nameOption: string;
    sectionName: string | null;
  }>;
  auditoires: Array<{
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

function buildOrganizationImportCopy(labels: PeopleLabels) {
  const studentLower = labels.studentLower;

  return {
    title: `Importer un ${studentLower}`,
    description: `Recherchez un ${studentLower} inscrit dans une autre branche de la meme organisation.`,
    emptyMessage: `Aucun ${studentLower} trouve.`,
    alreadyLinked: `Ce ${studentLower} est deja lie a cette branche`,
  };
}

function buildUniversityImportDescription(labels: PeopleLabels) {
  return `Selectionnez une filiere et un auditoire, puis importez l'${labels.studentLower} dans l'annee academique en cours.`;
}

export function ImportStudentDialog({
  open,
  onOpenChange,
  onSuccess,
  importScope = "school_only",
  requiresAuditoireOnImport = false,
  peopleLabels = DEFAULT_PEOPLE_LABELS,
}: ImportStudentDialogProps) {
  const copy =
    importScope === "organization"
      ? buildOrganizationImportCopy(peopleLabels)
      : IMPORT_COPY[importScope];
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [results, setResults] = useState<ImportSearchResult[]>([]);
  const [enrollmentOptions, setEnrollmentOptions] =
    useState<UniversityEnrollmentOption | null>(null);
  const [loadingEnrollmentOptions, setLoadingEnrollmentOptions] = useState(false);
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [selectedAuditoireId, setSelectedAuditoireId] = useState("");

  const filteredAuditoires =
    enrollmentOptions?.auditoires.filter(
      (auditoire) => auditoire.optionId === selectedFiliereId,
    ) ?? [];

  const canImport =
    !requiresAuditoireOnImport ||
    Boolean(selectedFiliereId && selectedAuditoireId && enrollmentOptions);

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
      setSelectedFiliereId("");
      setSelectedAuditoireId("");
      return;
    }

    if (requiresAuditoireOnImport) {
      setLoadingEnrollmentOptions(true);
      void getUniversityImportEnrollmentOptionsAction()
        .then((response) => {
          if (!response.ok) {
            toast.error(response.message);
            setEnrollmentOptions(null);
            return;
          }

          setEnrollmentOptions({
            filieres: response.filieres,
            auditoires: response.auditoires,
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
  }, [open, query, requiresAuditoireOnImport, searchStudents]);

  useEffect(() => {
    setSelectedAuditoireId("");
  }, [selectedFiliereId]);

  async function handleImport(student: ImportSearchResult) {
    if (student.alreadyLinked) {
      toast.info(copy.alreadyLinked);
      return;
    }

    if (!canImport) {
      toast.error("Selectionnez une filiere et un auditoire avant l'import");
      return;
    }

    setLinkingId(student.id);
    try {
      const result = await linkStudentToBranchAction({
        studentId: student.id,
        sourceBranchId: student.sourceBranchId,
        classeId: requiresAuditoireOnImport ? selectedAuditoireId : undefined,
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
            {requiresAuditoireOnImport
              ? buildUniversityImportDescription(peopleLabels)
              : copy.description}
          </DialogDescription>
        </DialogHeader>

        {requiresAuditoireOnImport ? (
          <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Filiere</label>
              <Select
                value={selectedFiliereId}
                onValueChange={setSelectedFiliereId}
                disabled={loadingEnrollmentOptions || !enrollmentOptions}
              >
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue
                    placeholder={
                      loadingEnrollmentOptions
                        ? "Chargement..."
                        : "Selectionner une filiere"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {enrollmentOptions?.filieres.map((filiere) => (
                    <SelectItem key={filiere.id} value={filiere.id}>
                      {filiere.nameOption}
                      {filiere.sectionName ? ` · ${filiere.sectionName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Auditoire</label>
              <Select
                value={selectedAuditoireId}
                onValueChange={setSelectedAuditoireId}
                disabled={
                  loadingEnrollmentOptions ||
                  !selectedFiliereId ||
                  filteredAuditoires.length === 0
                }
              >
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue
                    placeholder={
                      !selectedFiliereId
                        ? "Choisissez d'abord une filiere"
                        : filteredAuditoires.length === 0
                          ? "Aucun auditoire pour cette filiere"
                          : "Selectionner un auditoire"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredAuditoires.map((auditoire) => (
                    <SelectItem key={auditoire.id} value={auditoire.id}>
                      {auditoire.nameClasse}
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
