"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCertificate, IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentPdfPreviewDialog } from "@/components/documents/document-pdf-preview-dialog";
import { useDocumentPdfPreview } from "@/components/documents/use-document-pdf-preview";
import { useBranchRouteGuard } from "@/hooks/use-branch-route-guard";
import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";
import { createReleveNotesPdfOutput } from "@/lib/pdf/releve-notes-layout";
import {
  getUniversitySemesterFilterOptions,
} from "@/lib/university-lmd";
import { attachIssuedDocumentPdfAction } from "../../documents/issued-document.action";
import {
  getUniversityRelevesAction,
  issueReleveNotesAction,
  previewReleveNotesAction,
} from "../releve.action";
import Loading from "../../loading";

type UniversityLearner = {
  studentId: string;
  nom: string;
  postnom: string;
  prenom: string;
  username: string;
  auditoireName: string | null;
  auditoireLevel: string | null;
  filiereName: string | null;
  faculteName: string | null;
  sourceLabel: string;
  hasActiveEnrollment: boolean;
};

const DEFAULT_SEMESTER_OPTIONS = [
  { value: "all", label: "Relevé annuel" },
  { value: "1", label: "Premier semestre" },
  { value: "2", label: "Deuxième semestre" },
];

export function RelevesClient() {
  useBranchRouteGuard({ routeSuffix: "/releves" });

  const { label: schoolYearLabel } = useSchoolYearLabels();

  const { preview, openPreview, setPreviewOpen } = useDocumentPdfPreview();
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [context, setContext] = useState<{
    branchName: string;
    organizationName: string;
    schoolYearName: string;
    canManage: boolean;
    learners: UniversityLearner[];
    documents: Array<{ studentId: string }>;
  } | null>(null);

  const semesterOptions = useMemo(() => {
    const referenceLevel =
      context?.learners.find((learner) => learner.auditoireLevel)?.auditoireLevel ??
      undefined;

    if (!referenceLevel) {
      return DEFAULT_SEMESTER_OPTIONS;
    }

    return getUniversitySemesterFilterOptions(referenceLevel).map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }, [context?.learners]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await getUniversityRelevesAction();
        if (!data.ok) {
          toast.error(data.message);
          return;
        }

        setContext({
          branchName: data.branchName,
          organizationName: data.organizationName,
          schoolYearName: data.schoolYearName,
          canManage: data.canManage,
          learners: data.learners,
          documents: data.documents,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleIssue(learner: UniversityLearner) {
    setIssuingId(learner.studentId);
    try {
      const semesterOrder =
        semesterFilter === "all" ? undefined : Number(semesterFilter);

      const previewResult = await previewReleveNotesAction({
        studentId: learner.studentId,
        semesterOrder,
      });

      if (!previewResult.ok) {
        toast.error(previewResult.message);
        return;
      }

      if (!previewResult.releveData.semesters.length) {
        toast.error("Aucune note disponible pour cette periode");
        return;
      }

      const result = await issueReleveNotesAction({
        studentId: learner.studentId,
        semesterOrder,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const pdfOutput = createReleveNotesPdfOutput({
        ...result.document.releveData,
        organizationName: result.document.organizationName,
        branchName: result.document.branchName,
        releveNumber: result.document.releveNumber,
        issuedAt: new Date(result.document.issuedAt),
      });

      openPreview({
        title: result.document.title,
        description: "Previsualisez le releve avant impression ou enregistrement.",
        pdfOutput,
        documentId: result.document.id,
      });

      setContext((current) =>
        current
          ? {
              ...current,
              documents: [{ studentId: learner.studentId }, ...current.documents],
            }
          : current,
      );

      toast.success("Releve emis");
    } finally {
      setIssuingId(null);
    }
  }

  if (loading) return <Loading />;

  const issuedStudentIds = new Set(
    context?.documents.map((doc) => doc.studentId).filter(Boolean) ?? [],
  );

  return (
    <>
      <DocumentPdfPreviewDialog
        open={preview.open}
        onOpenChange={setPreviewOpen}
        title={preview.title}
        description={preview.description}
        pdfOutput={preview.pdfOutput}
        documentId={preview.documentId}
        onStorePdf={attachIssuedDocumentPdfAction}
      />

      <div className="space-y-4">
        <Card className="rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {context?.branchName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {context?.organizationName} · {schoolYearLabel} :{" "}
                {context?.schoolYearName}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="h-10 w-[200px] rounded-xl">
                  <SelectValue placeholder="Periode" />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge
                variant="outline-primary"
                icon={<IconCertificate size={14} />}
              >
                {context?.learners.length ?? 0} etudiant(s)
              </Badge>
            </div>
          </div>
        </Card>

        {!context?.learners.length ? (
          <Card className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Inscrivez des etudiants a un auditoire actif avant de generer des
            releves.
          </Card>
        ) : (
          <div className="grid gap-3">
            {context.learners.map((learner) => {
              const alreadyIssued = issuedStudentIds.has(learner.studentId);

              return (
                <Card
                  key={learner.studentId}
                  className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {learner.nom} {learner.postnom} {learner.prenom}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {learner.username} · {learner.sourceLabel}
                    </p>
                    {learner.auditoireName ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {learner.faculteName ? `${learner.faculteName} · ` : ""}
                        {learner.filiereName ? `${learner.filiereName} · ` : ""}
                        Auditoire : {learner.auditoireName}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {alreadyIssued ? (
                      <Badge variant="secondary">Releve deja emis</Badge>
                    ) : null}
                    {context.canManage && learner.hasActiveEnrollment ? (
                      <Button
                        leftSection={<IconDownload size={16} />}
                        loading={issuingId === learner.studentId}
                        disabled={issuingId !== null}
                        onClick={() => void handleIssue(learner)}
                      >
                        Generer releve
                      </Button>
                    ) : context.canManage && !learner.hasActiveEnrollment ? (
                      <Badge variant="outline">Auditoire requis</Badge>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
