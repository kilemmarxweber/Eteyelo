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
import {
  createUniversityAttestationPdfOutput,
  type UniversityAttestationKind,
} from "@/lib/pdf/university-attestation-layout";
import {
  formatUniversitySemesterLabel,
  getUniversitySemesterFilterOptions,
} from "@/lib/university-lmd";
import { attachIssuedDocumentPdfAction } from "../../documents/issued-document.action";
import {
  getUniversityAttestationsAction,
  issueUniversityAttestationAction,
} from "../../releves/releve.action";
import Loading from "../../loading";

type UniversityLearner = {
  studentId: string;
  nom: string;
  postnom: string;
  prenom: string;
  username: string;
  auditoireName: string | null;
  auditoireLevel: string | null;
  sourceLabel: string;
};

export function UniversityAttestationsClient() {
  useBranchRouteGuard({ routeSuffix: "/attestations" });

  const { label: schoolYearLabel } = useSchoolYearLabels();

  const { preview, openPreview, setPreviewOpen } = useDocumentPdfPreview();
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] =
    useState<UniversityAttestationKind>("INSCRIPTION");
  const [semesterFilter, setSemesterFilter] = useState<"1" | "2">("1");
  const [context, setContext] = useState<{
    branchName: string;
    organizationName: string;
    schoolYearName: string;
    canManage: boolean;
    learners: UniversityLearner[];
    attestationKinds: Array<{ value: UniversityAttestationKind; label: string }>;
  } | null>(null);

  const semesterOptions = useMemo(
    () =>
      getUniversitySemesterFilterOptions(
        context?.learners.find((learner) => learner.auditoireLevel)?.auditoireLevel,
      ).filter((option) => option.value === "1" || option.value === "2"),
    [context?.learners],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await getUniversityAttestationsAction();
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
          attestationKinds: data.attestationKinds,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleIssue(learner: UniversityLearner) {
    setIssuingId(learner.studentId);
    try {
      const semesterLabel =
        selectedKind === "REUSSITE_SEMESTRE"
          ? formatUniversitySemesterLabel(
              semesterFilter === "2" ? 2 : 1,
              learner.auditoireLevel,
            )
          : undefined;

      const result = await issueUniversityAttestationAction({
        studentId: learner.studentId,
        kind: selectedKind,
        semesterLabel,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const pdfOutput = createUniversityAttestationPdfOutput({
        organizationName: result.document.organizationName,
        branchName: result.document.branchName,
        schoolYearName: result.document.schoolYearName,
        studentName: result.document.studentName,
        username: result.document.username,
        auditoireName: result.document.auditoireName,
        filiereName: result.document.filiereName,
        faculteName: result.document.faculteName,
        semesterLabel: result.document.semesterLabel,
        kind: result.document.kind,
        issuedAt: new Date(result.document.issuedAt),
      });

      openPreview({
        title: result.document.title,
        description: "Previsualisez l'attestation avant impression ou enregistrement.",
        pdfOutput,
        documentId: result.document.id,
      });

      toast.success("Attestation emise");
    } finally {
      setIssuingId(null);
    }
  }

  if (loading) return <Loading />;

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
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Type d&apos;attestation
              </label>
              <Select
                value={selectedKind}
                onValueChange={(value) =>
                  setSelectedKind(value as UniversityAttestationKind)
                }
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {context?.attestationKinds.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedKind === "REUSSITE_SEMESTRE" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Semestre concerne
                </label>
                <Select
                  value={semesterFilter}
                  onValueChange={(value) => setSemesterFilter(value as "1" | "2")}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {semesterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div />
            )}

            <Badge variant="outline-primary" icon={<IconCertificate size={14} />}>
              {context?.learners.length ?? 0} etudiant(s)
            </Badge>
          </div>
        </Card>

        {!context?.learners.length ? (
          <Card className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Inscrivez des etudiants a un auditoire actif avant d&apos;emettre des
            attestations.
          </Card>
        ) : (
          <div className="grid gap-3">
            {context.learners.map((learner) => (
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
                      Auditoire : {learner.auditoireName}
                    </p>
                  ) : null}
                </div>

                {context.canManage ? (
                  <Button
                    leftSection={<IconDownload size={16} />}
                    loading={issuingId === learner.studentId}
                    disabled={issuingId !== null}
                    onClick={() => void handleIssue(learner)}
                  >
                    Emettre attestation
                  </Button>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
