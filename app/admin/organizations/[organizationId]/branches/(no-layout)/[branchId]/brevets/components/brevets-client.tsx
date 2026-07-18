"use client";

import { useEffect, useState } from "react";
import { IconCertificate, IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DocumentPdfPreviewDialog } from "@/components/documents/document-pdf-preview-dialog";
import { useDocumentPdfPreview } from "@/components/documents/use-document-pdf-preview";
import { useBranchRouteGuard } from "@/hooks/use-branch-route-guard";
import { createBrevetPdfOutput } from "@/lib/pdf/brevet-layout";
import { attachIssuedDocumentPdfAction } from "../../documents/issued-document.action";
import {
  getCentreBrevetsAction,
  issueCentreBrevetAction,
} from "../brevet.action";
import Loading from "../../loading";

type BrevetLearner = {
  studentId: string;
  nom: string;
  postnom: string;
  prenom: string;
  username: string;
  programmeName: string | null;
  sessionName: string | null;
  sourceLabel: string;
  isLinked: boolean;
};

export function BrevetsClient() {
  useBranchRouteGuard({ routeSuffix: "/brevets" });

  const { preview, openPreview, setPreviewOpen } = useDocumentPdfPreview();
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [context, setContext] = useState<{
    branchName: string;
    branchCode: string;
    organizationName: string;
    schoolYearName: string;
    canManage: boolean;
    learners: BrevetLearner[];
    documents: Array<{
      id: string;
      studentId: string;
      title: string;
      issuedAt: string;
      metadata: unknown;
    }>;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await getCentreBrevetsAction();
        if (!data.ok) {
          toast.error(data.message);
          return;
        }

        setContext({
          branchName: data.branchName,
          branchCode: data.branchCode,
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

  async function handleIssue(learner: BrevetLearner) {
    setIssuingId(learner.studentId);
    try {
      const result = await issueCentreBrevetAction({
        studentId: learner.studentId,
        programmeName: learner.programmeName ?? undefined,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const pdfOutput = createBrevetPdfOutput({
        organizationName: result.document.organizationName,
        branchName: result.document.branchName,
        branchCode: result.document.branchCode,
        schoolYearName: result.document.schoolYearName,
        studentName: result.document.studentName,
        username: result.document.username,
        programmeName: result.document.programmeName,
        sessionName: result.document.sessionName,
        brevetNumber: result.document.brevetNumber,
        issuedAt: new Date(result.document.issuedAt),
      });

      openPreview({
        title: result.document.title,
        description: "Previsualisez le brevet avant impression ou enregistrement.",
        pdfOutput,
        documentId: result.document.id,
      });

      setContext((current) =>
        current
          ? {
              ...current,
              documents: [
                {
                  id: result.document.id,
                  studentId: learner.studentId,
                  title: result.document.title,
                  issuedAt: result.document.issuedAt,
                  metadata: { brevetNumber: result.document.brevetNumber },
                },
                ...current.documents,
              ],
            }
          : current,
      );

      toast.success("Brevet emis");
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {context?.branchName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {context?.organizationName} · {context?.schoolYearName}
              </p>
            </div>
            <Badge variant="outline-primary" icon={<IconCertificate size={14} />}>
              {context?.learners.length ?? 0} apprenant(s)
            </Badge>
          </div>
        </Card>

        {!context?.learners.length ? (
          <Card className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Inscrivez des apprenants a une session active avant d&apos;emettre des
            brevets.
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
                    {learner.programmeName ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Programme : {learner.programmeName}
                        {learner.sessionName
                          ? ` · Session : ${learner.sessionName}`
                          : ""}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {alreadyIssued ? (
                      <Badge variant="secondary">Brevet deja emis</Badge>
                    ) : null}
                    {context.canManage && learner.sessionName ? (
                      <Button
                        leftSection={<IconDownload size={16} />}
                        loading={issuingId === learner.studentId}
                        disabled={issuingId !== null || alreadyIssued}
                        onClick={() => void handleIssue(learner)}
                      >
                        Emettre brevet
                      </Button>
                    ) : context.canManage && !learner.sessionName ? (
                      <Badge variant="outline">Session requise</Badge>
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
