"use client";

import { useEffect, useState } from "react";
import { IconCertificate, IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocumentPdfPreviewDialog } from "@/components/documents/document-pdf-preview-dialog";
import { useDocumentPdfPreview } from "@/components/documents/use-document-pdf-preview";
import { useBranchRouteGuard } from "@/hooks/use-branch-route-guard";
import { createAttestationPdfOutput } from "@/lib/pdf/attestation-layout";
import { attachIssuedDocumentPdfAction } from "../../documents/issued-document.action";
import {
  getAtelierAttestationsAction,
  issueAtelierAttestationAction,
} from "../../brevets/brevet.action";
import Loading from "../../loading";

type AttestationParticipant = {
  studentId: string;
  nom: string;
  postnom: string;
  prenom: string;
  username: string;
  sourceBranchName: string;
  groupName: string | null;
};

export function AttestationsClient() {
  useBranchRouteGuard({ routeSuffix: "/attestations" });

  const { preview, openPreview, setPreviewOpen } = useDocumentPdfPreview();
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [workshopName, setWorkshopName] = useState("");
  const [context, setContext] = useState<{
    branchName: string;
    organizationName: string;
    schoolYearName: string;
    canManage: boolean;
    participants: AttestationParticipant[];
  } | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await getAtelierAttestationsAction();
        if (!data.ok) {
          toast.error(data.message);
          return;
        }

        setContext({
          branchName: data.branchName,
          organizationName: data.organizationName,
          schoolYearName: data.schoolYearName,
          canManage: data.canManage,
          participants: data.participants,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleIssue(participant: AttestationParticipant) {
    setIssuingId(participant.studentId);
    try {
      const result = await issueAtelierAttestationAction({
        studentId: participant.studentId,
        workshopName: workshopName.trim() || undefined,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const pdfOutput = createAttestationPdfOutput({
        organizationName: context?.organizationName ?? "",
        branchName: context?.branchName ?? "",
        schoolYearName: context?.schoolYearName,
        studentName: `${participant.nom} ${participant.postnom} ${participant.prenom}`.trim(),
        username: participant.username,
        sourceBranchName: participant.sourceBranchName,
        groupName: participant.groupName,
        workshopName: workshopName.trim() || undefined,
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
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Nom de l&apos;atelier / module (optionnel)
              </label>
              <Input
                value={workshopName}
                onChange={(event) => setWorkshopName(event.target.value)}
                placeholder="Ex. Atelier menuiserie"
                className="h-10 rounded-xl"
              />
            </div>
            <Badge variant="outline-primary" icon={<IconCertificate size={14} />}>
              {context?.participants.length ?? 0} participant(s)
            </Badge>
          </div>
        </Card>

        {!context?.participants.length ? (
          <Card className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Importez des eleves scolaires dans l&apos;atelier avant d&apos;emettre
            des attestations.
          </Card>
        ) : (
          <div className="grid gap-3">
            {context.participants.map((participant) => (
              <Card
                key={participant.studentId}
                className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {participant.nom} {participant.postnom} {participant.prenom}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {participant.username} · {participant.sourceBranchName}
                  </p>
                  {participant.groupName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Groupe : {participant.groupName}
                    </p>
                  ) : null}
                </div>

                {context.canManage ? (
                  <Button
                    leftSection={<IconDownload size={16} />}
                    loading={issuingId === participant.studentId}
                    disabled={issuingId !== null}
                    onClick={() => void handleIssue(participant)}
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
