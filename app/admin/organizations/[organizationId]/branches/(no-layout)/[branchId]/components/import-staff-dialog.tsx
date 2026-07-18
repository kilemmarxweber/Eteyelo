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
import { BranchTypeBadge } from "@/components/branch/branch-type-badge";
import type { ImportStaffSearchResult } from "@/lib/extended-staff-import";
import type { PeopleLabels } from "@/lib/people-labels";
import { DEFAULT_PEOPLE_LABELS } from "@/lib/people-labels";
import {
  linkPersonnelToBranchAction,
  linkTeacherToBranchAction,
  searchOrganizationPersonnelsForImport,
  searchOrganizationTeachersForImport,
} from "../staff-import.action";

type StaffKind = "teacher" | "personnel";

type ImportStaffDialogProps = {
  kind: StaffKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  peopleLabels?: PeopleLabels;
};

function buildTeacherImportCopy(labels: PeopleLabels) {
  const teacherLower = labels.teacherLower;

  return {
    title: `Importer un ${teacherLower}`,
    description: `Recherchez un ${teacherLower} inscrit dans une autre branche de la meme organisation.`,
    emptyMessage: `Aucun ${teacherLower} trouve.`,
    alreadyLinked: `Ce ${teacherLower} est deja present dans cette branche`,
    successMessage: `${labels.teacher} importe avec succes`,
  };
}

const IMPORT_COPY: Record<
  StaffKind,
  {
    title: string;
    description: string;
    emptyMessage: string;
    alreadyLinked: string;
    successMessage: string;
  }
> = {
  teacher: {
    title: "Importer un enseignant",
    description:
      "Recherchez un enseignant inscrit dans une autre branche de la meme organisation.",
    emptyMessage: "Aucun enseignant trouve.",
    alreadyLinked: "Cet enseignant est deja present dans cet atelier",
    successMessage: "Enseignant importe avec succes",
  },
  personnel: {
    title: "Importer un personnel",
    description:
      "Recherchez un membre du personnel inscrit dans une autre branche de la meme organisation.",
    emptyMessage: "Aucun personnel trouve.",
    alreadyLinked: "Ce personnel est deja present dans cet atelier",
    successMessage: "Personnel importe avec succes",
  },
};

export function ImportStaffDialog({
  kind,
  open,
  onOpenChange,
  onSuccess,
  peopleLabels = DEFAULT_PEOPLE_LABELS,
}: ImportStaffDialogProps) {
  const copy =
    kind === "teacher"
      ? buildTeacherImportCopy(peopleLabels)
      : IMPORT_COPY[kind];
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [results, setResults] = useState<ImportStaffSearchResult[]>([]);

  const searchStaff = useCallback(
    async (value: string) => {
      setLoading(true);
      try {
        const response =
          kind === "teacher"
            ? await searchOrganizationTeachersForImport({
                query: value,
                limit: 30,
              })
            : await searchOrganizationPersonnelsForImport({
                query: value,
                limit: 30,
              });

        if (!response.ok) {
          toast.error(response.message);
          setResults([]);
          return;
        }

        setResults(response.staff);
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLinkingId(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      void searchStaff(query);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [open, query, searchStaff]);

  async function handleImport(staff: ImportStaffSearchResult) {
    if (staff.alreadyLinked) {
      toast.info(copy.alreadyLinked);
      return;
    }

    setLinkingId(staff.id);
    try {
      const result =
        kind === "teacher"
          ? await linkTeacherToBranchAction({
              teacherId: staff.id,
              sourceBranchId: staff.sourceBranchId,
            })
          : await linkPersonnelToBranchAction({
              personnelId: staff.id,
              sourceBranchId: staff.sourceBranchId,
            });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(copy.successMessage);
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
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, prenom ou identifiant..."
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
            ? results.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {staff.nom} {staff.postnom} {staff.prenom}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {staff.username} · {staff.sourceBranchName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <BranchTypeBadge typebranch={staff.sourceBranchType} />
                      {staff.alreadyLinked ? (
                        <Badge variant="secondary">Deja importe</Badge>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    leftSection={<IconUserPlus size={16} />}
                    loading={linkingId === staff.id}
                    disabled={staff.alreadyLinked || linkingId !== null}
                    onClick={() => void handleImport(staff)}
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
