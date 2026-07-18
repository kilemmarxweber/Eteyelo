"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  Eye,
  FileText,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentPdfPreviewDialog } from "@/components/documents/document-pdf-preview-dialog";
import { useDocumentPdfPreview } from "@/components/documents/use-document-pdf-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createReleveNotesPdfOutput } from "@/lib/pdf/releve-notes-layout";
import {
  buildStudentReleveForPeriod,
  createEmptyStudentDocumentsData,
  filterStudentDocumentsByPeriod,
  type StudentDocumentsData,
} from "@/lib/student-documents";
import { downloadPdfOutput } from "@/lib/pdf/pdf-engine";

type StudentDocumentsSectionProps = {
  documents?: StudentDocumentsData | null;
};

function formatScore(score: number | null, maxScore: number) {
  if (score == null) return "—";
  if (maxScore > 0) return `${score}/${maxScore}`;
  return String(score);
}

export function StudentDocumentsSection({
  documents: documentsProp,
}: StudentDocumentsSectionProps) {
  const documents = documentsProp ?? createEmptyStudentDocumentsData();
  const { preview, openPreview, setPreviewOpen } = useDocumentPdfPreview();

  const periodLabels = React.useMemo(() => {
    const labels = new Set<string>();
    for (const period of documents.periods) labels.add(period.label);
    for (const item of documents.pendingInterventions) labels.add(item.periodName);
    for (const item of documents.validatedScores) labels.add(item.periodName);
    return Array.from(labels).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  }, [documents]);

  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("all");

  const filteredPendingInterventions = React.useMemo(
    () =>
      filterStudentDocumentsByPeriod(
        documents.pendingInterventions,
        selectedPeriod === "all" ? null : selectedPeriod,
      ),
    [documents.pendingInterventions, selectedPeriod],
  );

  const filteredValidatedScores = React.useMemo(
    () =>
      filterStudentDocumentsByPeriod(
        documents.validatedScores,
        selectedPeriod === "all" ? null : selectedPeriod,
      ),
    [documents.validatedScores, selectedPeriod],
  );

  const relevePreviewData = React.useMemo(
    () =>
      buildStudentReleveForPeriod(
        documents,
        selectedPeriod === "all" ? null : selectedPeriod,
      ),
    [documents, selectedPeriod],
  );

  const hasValidatedResults =
    filteredValidatedScores.length > 0 ||
    (relevePreviewData?.semesters.length ?? 0) > 0;

  function handlePreviewReleve() {
    if (!relevePreviewData?.semesters.length) {
      toast.error("Aucune note validee disponible pour ce releve.");
      return;
    }

    const pdfOutput = createReleveNotesPdfOutput({
      ...relevePreviewData,
      organizationName: documents.organizationName,
      branchName: documents.branchName,
      releveNumber: `APERCU-${documents.matricule || documents.studentName}`,
      issuedAt: new Date(),
    });

    openPreview({
      title: "Releve de notes",
      description: "Apercu du releve selon la periode selectionnee.",
      pdfOutput,
    });
  }

  function handleDownloadReleve() {
    if (!relevePreviewData?.semesters.length) {
      toast.error("Aucune note validee disponible pour ce releve.");
      return;
    }

    const pdfOutput = createReleveNotesPdfOutput({
      ...relevePreviewData,
      organizationName: documents.organizationName,
      branchName: documents.branchName,
      releveNumber: `APERCU-${documents.matricule || documents.studentName}`,
      issuedAt: new Date(),
    });

    downloadPdfOutput(pdfOutput);
  }

  return (
    <>
      <DocumentPdfPreviewDialog
        open={preview.open}
        onOpenChange={setPreviewOpen}
        title={preview.title}
        description={preview.description}
        pdfOutput={preview.pdfOutput}
        storeOnConfirm={false}
      />

      <div className="space-y-4">
        <Card className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Periode scolaire</h3>
              <p className="text-xs text-muted-foreground">
                Les resultats valides apparaissent en haut. Les devoirs et
                evaluations en attente sont listes en bas.
              </p>
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full lg:w-[280px]">
                <SelectValue placeholder="Choisir une periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les periodes</SelectItem>
                {periodLabels.map((period) => (
                  <SelectItem key={period} value={period}>
                    {period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">Resultats valides</h3>
              <p className="text-xs text-muted-foreground">
                Notes consolidees apres validation de la fiche centrale.
              </p>
            </div>
          </div>

          {filteredValidatedScores.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Matiere</th>
                    <th className="px-3 py-2">Periode</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Pourcentage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredValidatedScores.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3 font-medium">{item.subjectName}</td>
                      <td className="px-3 py-3">{item.periodName}</td>
                      <td className="px-3 py-3 tabular-nums">
                        {item.score}/{item.maxScore}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{item.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun resultat valide pour cette periode. Les notes apparaitront ici
              apres validation de la fiche centrale.
            </p>
          )}
        </Card>

        <Card className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">Releve de notes</h3>
                <p className="text-xs text-muted-foreground">
                  Apercu du releve selon la periode selectionnee.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={!relevePreviewData?.semesters.length}
                onClick={handlePreviewReleve}
              >
                <Eye className="size-4" />
                Apercu releve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!relevePreviewData?.semesters.length}
                onClick={handleDownloadReleve}
              >
                <FileText className="size-4" />
                Telecharger
              </Button>
              <Button asChild type="button" variant="outline" size="sm" className="gap-2">
                <Link href={documents.relevesHref}>
                  Releves officiels
                </Link>
              </Button>
            </div>
          </div>

          {relevePreviewData?.semesters.length ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              <p>
                Releve disponible pour{" "}
                <span className="font-medium text-foreground">
                  {selectedPeriod === "all"
                    ? "toutes les periodes validees"
                    : selectedPeriod}
                </span>
                .
              </p>
              <p className="mt-2">
                Moyenne generale :{" "}
                <span className="font-medium text-foreground">
                  {relevePreviewData.overallAverage.toFixed(1)}%
                </span>
              </p>
              <p className="mt-1">
                Matieres :{" "}
                <span className="font-medium text-foreground">
                  {relevePreviewData.semesters
                    .flatMap((semester) => semester.courses.map((course) => course.courseName))
                    .join(", ") || "—"}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Le releve sera disponible des que les notes seront validees dans la
              fiche centrale.
            </p>
          )}
        </Card>

        <Card className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="size-4 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold">
                Devoirs et evaluations en attente
              </h3>
              <p className="text-xs text-muted-foreground">
                Interventions saisies mais pas encore validees dans la fiche
                centrale.
              </p>
            </div>
          </div>

          {filteredPendingInterventions.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Matiere</th>
                    <th className="px-3 py-2">Periode</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Enseignant</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingInterventions.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3 whitespace-nowrap">{item.dateLabel}</td>
                      <td className="px-3 py-3">{item.typeFiche}</td>
                      <td className="px-3 py-3 font-medium">{item.subjectName}</td>
                      <td className="px-3 py-3">{item.periodName}</td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatScore(item.score, item.maxScore)}
                        {item.percentage != null ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({item.percentage}%)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">{item.teacherName}</td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-700"
                        >
                          En attente
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun devoir ou evaluation en attente pour cette periode.
            </p>
          )}

          {!hasValidatedResults && filteredPendingInterventions.length > 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Les notes ci-dessus restent provisoires tant que la fiche centrale
              n&apos;est pas validee.
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
