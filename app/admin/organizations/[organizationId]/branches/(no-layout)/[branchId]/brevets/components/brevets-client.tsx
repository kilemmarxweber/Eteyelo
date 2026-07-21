"use client";

import { useEffect, useMemo, useState } from "react";
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
  enrollmentId: string;
  classeId: string;
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

type IssuedBrevetDocument = {
  id: string;
  studentId: string | null;
  title: string;
  issuedAt: string;
  metadata: unknown;
};

function getIssuedClasseIds(documents: IssuedBrevetDocument[]) {
  const issued = new Set<string>();

  for (const document of documents) {
    if (!document.studentId || !document.metadata || typeof document.metadata !== "object") {
      continue;
    }

    const metadata = document.metadata as Record<string, unknown>;
    if (typeof metadata.classeId === "string") {
      issued.add(`${document.studentId}:${metadata.classeId}`);
      continue;
    }

    const programmeName =
      typeof metadata.programmeName === "string" ? metadata.programmeName : "";
    const sessionName =
      typeof metadata.sessionName === "string" ? metadata.sessionName : "";
    if (programmeName && sessionName) {
      issued.add(`${document.studentId}:${programmeName}:${sessionName}`);
    }
  }

  return issued;
}

function isBrevetIssuedForEnrollment(
  learner: BrevetLearner,
  issuedKeys: Set<string>,
) {
  if (issuedKeys.has(`${learner.studentId}:${learner.classeId}`)) {
    return true;
  }

  if (learner.programmeName && learner.sessionName) {
    return issuedKeys.has(
      `${learner.studentId}:${learner.programmeName}:${learner.sessionName}`,
    );
  }

  return false;
}

export function BrevetsClient() {
  useBranchRouteGuard({ routeSuffix: "/brevets" });

  const { preview, openPreview, setPreviewOpen } = useDocumentPdfPreview();
  const [loading, setLoading] = useState(true);
  const [issuingKey, setIssuingKey] = useState<string | null>(null);
  const [context, setContext] = useState<{
    branchName: string;
    branchCode: string;
    organizationName: string;
    schoolYearName: string;
    canManage: boolean;
    learners: BrevetLearner[];
    documents: IssuedBrevetDocument[];
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

  const issuedKeys = useMemo(
    () => getIssuedClasseIds(context?.documents ?? []),
    [context?.documents],
  );

  async function handleIssue(learner: BrevetLearner) {
    const rowKey = learner.enrollmentId;
    setIssuingKey(rowKey);
    try {
      const result = await issueCentreBrevetAction({
        studentId: learner.studentId,
        enrollmentId: learner.enrollmentId,
        classeId: learner.classeId,
        programmeName: learner.programmeName ?? undefined,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const pdfOutput = await createBrevetPdfOutput({
        organizationName: result.document.organizationName,
        branchName: result.document.branchName,
        branchCode: result.document.branchCode,
        branchCity: result.document.branchCity,
        schoolYearName: result.document.schoolYearName,
        studentName: result.document.studentName,
        username: result.document.username,
        programmeName: result.document.programmeName,
        sessionName: result.document.sessionName,
        brevetNumber: result.document.brevetNumber,
        issuedAt: new Date(result.document.issuedAt),
        placeOfBirth: result.document.placeOfBirth,
        dateOfBirth: result.document.dateOfBirth
          ? new Date(result.document.dateOfBirth)
          : null,
        sexe: result.document.sexe,
        trainingStartDate: result.document.trainingStartDate
          ? new Date(result.document.trainingStartDate)
          : null,
        trainingEndDate: result.document.trainingEndDate
          ? new Date(result.document.trainingEndDate)
          : null,
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
                  metadata: {
                    brevetNumber: result.document.brevetNumber,
                    programmeName: result.document.programmeName,
                    sessionName: result.document.sessionName,
                    classeId: learner.classeId,
                  },
                },
                ...current.documents,
              ],
            }
          : current,
      );

      toast.success("Brevet emis");
    } finally {
      setIssuingKey(null);
    }
  }

  if (loading) return <Loading />;

  const distinctStudents = new Set(context?.learners.map((learner) => learner.studentId));

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
              <p className="mt-2 text-xs text-muted-foreground">
                Un brevet peut etre emis par programme et session. Un apprenant
                inscrit a plusieurs formations peut recevoir plusieurs brevets.
              </p>
            </div>
            <Badge variant="outline-primary" icon={<IconCertificate size={14} />}>
              {distinctStudents.size} apprenant(s) · {context?.learners.length ?? 0}{" "}
              inscription(s)
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
              const alreadyIssued = isBrevetIssuedForEnrollment(learner, issuedKeys);
              const rowKey = learner.enrollmentId;

              return (
                <Card
                  key={rowKey}
                  className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {learner.nom} {learner.postnom} {learner.prenom}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {learner.username} · {learner.sourceLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Programme : {learner.programmeName ?? "—"}
                      {learner.sessionName
                        ? ` · Session : ${learner.sessionName}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {alreadyIssued ? (
                      <Badge variant="secondary">Brevet deja emis</Badge>
                    ) : null}
                    {context.canManage ? (
                      <Button
                        leftSection={<IconDownload size={16} />}
                        loading={issuingKey === rowKey}
                        disabled={issuingKey !== null || alreadyIssued}
                        onClick={() => void handleIssue(learner)}
                      >
                        Emettre brevet
                      </Button>
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
