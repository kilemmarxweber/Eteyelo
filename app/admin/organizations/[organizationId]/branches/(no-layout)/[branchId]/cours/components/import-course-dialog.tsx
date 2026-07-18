"use client";

import { useCallback, useEffect, useState } from "react";
import { IconBook2, IconSearch } from "@tabler/icons-react";
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
import type { ImportCourseSearchResult } from "@/lib/extended-course-import";
import {
  importCourseFromBranchAction,
  searchOrganizationCoursesForImportAction,
} from "../cours.action";

type ImportCourseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function ImportCourseDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportCourseDialogProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [results, setResults] = useState<ImportCourseSearchResult[]>([]);

  const searchCourses = useCallback(async (value: string) => {
    setLoading(true);
    try {
      const response = await searchOrganizationCoursesForImportAction({
        query: value,
        limit: 30,
      });

      if (!response.ok) {
        toast.error(response.message);
        setResults([]);
        return;
      }

      setResults(response.courses);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setImportingId(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      void searchCourses(query);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [open, query, searchCourses]);

  async function handleImport(course: ImportCourseSearchResult) {
    if (course.alreadyImported) {
      toast.info("Ce cours existe deja dans cette branche");
      return;
    }

    setImportingId(course.id);
    try {
      const result = await importCourseFromBranchAction({
        courseId: course.id,
        sourceBranchId: course.sourceBranchId,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Cours importe avec succes");
      onSuccess();
      onOpenChange(false);
    } finally {
      setImportingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Importer un cours</DialogTitle>
          <DialogDescription>
            Recherchez un cours dans une autre branche de la meme organisation.
            Les ponderations par filiere sont copiees lorsque les filieres
            correspondent.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, code ou description..."
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
              Aucun cours trouve.
            </p>
          ) : null}

          {!loading
            ? results.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {course.nameCours}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {course.codeCours} · {course.sourceBranchName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <BranchTypeBadge typebranch={course.sourceBranchType} />
                      {course.alreadyImported ? (
                        <Badge variant="secondary">Deja importe</Badge>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    leftSection={<IconBook2 size={16} />}
                    loading={importingId === course.id}
                    disabled={course.alreadyImported || importingId !== null}
                    onClick={() => void handleImport(course)}
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
