"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Check, ImagePlus, MessageSquare, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  reviewAbsenceJustificationAction,
  submitAbsenceJustificationAction,
} from "@/lib/actions/absence.actions";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  uploadFile,
} from "@/lib/upload-file";
import { MAX_ABSENCE_JUSTIFICATION_IMAGES } from "@/lib/absence-justification-shared";

export type AbsenceCaseDialogData = {
  id: string;
  status: string;
  subjectType: string;
  contextLabel: string;
  occurredOn: string;
  personName: string;
  justification: string | null;
  justificationImageUrls?: string[];
  reviewComment: string | null;
  reviewerName?: string | null;
};

function formatOccurredOn(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function subjectLabel(type: string) {
  if (type === "TEACHER") return "Enseignant";
  if (type === "PERSONNEL") return "Personnel";
  return "Élève";
}

export function AbsenceProofImages({
  urls,
  onRemove,
}: {
  urls: string[];
  onRemove?: (url: string) => void;
}) {
  if (!urls.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url) => (
        <div key={url} className="relative overflow-hidden rounded-md border bg-muted/30">
          <a href={url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="aspect-square h-24 w-full object-cover"
            />
          </a>
          {onRemove ? (
            <button
              type="button"
              className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground"
              onClick={() => onRemove(url)}
              aria-label="Retirer l'image"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AbsenceCaseDialog({
  open,
  onOpenChange,
  mode,
  caseRow,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "justify" | "review" | "view";
  caseRow: AbsenceCaseDialogData | null;
  onDone?: () => void;
}) {
  const t = useTranslations("dashboard.absence");
  const [text, setText] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const params = useParams<{ organizationId?: string; branchId?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setText("");
      setImageUrls(
        mode === "justify" ? (caseRow?.justificationImageUrls ?? []) : [],
      );
    }
  }, [open, caseRow?.id, caseRow?.justificationImageUrls, mode]);

  const title =
    mode === "justify"
      ? "Justifier l'absence"
      : mode === "review"
        ? "Examiner la justification"
        : "Détail de l'absence";

  const existingImages = caseRow?.justificationImageUrls ?? [];
  const canAddMore = imageUrls.length < MAX_ABSENCE_JUSTIFICATION_IMAGES;

  async function addImages(files: FileList | File[]) {
    const remaining = MAX_ABSENCE_JUSTIFICATION_IMAGES - imageUrls.length;
    const selected = Array.from(files).slice(0, remaining);
    if (!selected.length) return;
    setBusy(true);
    try {
      const next = [...imageUrls];
      for (const file of selected) {
        if (!file.type.startsWith("image/")) {
          toast.error("Choisissez une image (JPEG, PNG, WebP…).");
          continue;
        }
        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
          toast.error("Image trop volumineuse (max. 5 Mo).");
          continue;
        }
        const uploaded = await uploadFile(file);
        if (!uploaded.ok) {
          toast.error(uploaded.message);
          continue;
        }
        next.push(uploaded.url);
      }
      setImageUrls(next.slice(0, MAX_ABSENCE_JUSTIFICATION_IMAGES));
    } finally {
      setBusy(false);
    }
  }

  async function submitJustification() {
    if (!caseRow) return;
    setBusy(true);
    try {
      const [, err] = await submitAbsenceJustificationAction({
        caseId: caseRow.id,
        justification: text,
        imageUrls,
      });
      if (err) {
        toast.error(
          err.message || "Impossible d'envoyer la justification.",
        );
        return;
      }
      toast.success("Justification envoyée. La direction va l'examiner.");
      setText("");
      setImageUrls([]);
      onOpenChange(false);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  async function review(decision: "ACCEPTED" | "REJECTED") {
    if (!caseRow) return;
    setBusy(true);
    try {
      const [, err] = await reviewAbsenceJustificationAction({
        caseId: caseRow.id,
        decision,
        comment: text || undefined,
      });
      if (err) {
        toast.error(err.message || "Impossible d'enregistrer la décision.");
        return;
      }
      toast.success(
        decision === "ACCEPTED"
          ? "Justification acceptée. Un retour a été signalé."
          : "Justification refusée.",
      );
      setText("");
      onOpenChange(false);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  const accepted = caseRow?.status === "ACCEPTED";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setText("");
          setImageUrls([]);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {caseRow
              ? `${caseRow.personName} · ${subjectLabel(caseRow.subjectType)}`
              : "Absence"}
          </DialogDescription>
        </DialogHeader>

        {caseRow ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Séance : </span>
              {caseRow.contextLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Date : </span>
              {formatOccurredOn(caseRow.occurredOn)}
            </p>
            {caseRow.justification ? (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Justification
                </p>
                <p className="mt-1 whitespace-pre-wrap">{caseRow.justification}</p>
                {mode !== "justify" ? (
                  <div className="mt-2">
                    <AbsenceProofImages urls={existingImages} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {accepted ? (
              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  {t("superiorResponse")}
                </p>
                {caseRow.reviewerName ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("acceptedBy", { name: caseRow.reviewerName })}
                  </p>
                ) : null}
                {caseRow.reviewComment ? (
                  <p className="mt-1 whitespace-pre-wrap">{caseRow.reviewComment}</p>
                ) : (
                  <p className="mt-1 text-sm">{t("accepted")}</p>
                )}
              </div>
            ) : caseRow.reviewComment ? (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Décision
                </p>
                {caseRow.reviewerName ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {caseRow.reviewerName}
                  </p>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap">{caseRow.reviewComment}</p>
              </div>
            ) : null}

            {mode === "justify" ? (
              <>
                <Textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Expliquez le motif de votre absence…"
                  rows={5}
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("proofImages")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("maxProof", {
                        count: imageUrls.length,
                        max: MAX_ABSENCE_JUSTIFICATION_IMAGES,
                      })}
                    </p>
                  </div>
                  <AbsenceProofImages
                    urls={imageUrls}
                    onRemove={(url) =>
                      setImageUrls((current) =>
                        current.filter((item) => item !== url),
                      )
                    }
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files;
                      event.target.value = "";
                      if (files?.length) void addImages(files);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy || !canAddMore}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="size-3.5" />
                    {t("addProof")}
                  </Button>
                </div>
              </>
            ) : null}

            {mode === "review" ? (
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Commentaire de décision (optionnel)"
                rows={3}
              />
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {caseRow && params.organizationId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const qs = new URLSearchParams({
                  contextType: "ABSENCE_CASE",
                  contextId: caseRow.id,
                });
                if (params.branchId) qs.set("fromBranch", params.branchId);
                onOpenChange(false);
                router.push(
                  `/admin/organizations/${params.organizationId}/messagerie?${qs.toString()}`,
                );
              }}
            >
              <MessageSquare className="mr-1.5 size-3.5" />
              Répondre
            </Button>
          ) : null}
          {mode === "justify" ? (
            <Button
              type="button"
              disabled={busy || text.trim().length < 8}
              onClick={() => void submitJustification()}
            >
              Envoyer la justification
            </Button>
          ) : null}
          {mode === "review" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void review("REJECTED")}
              >
                <X className="mr-1.5 size-3.5" />
                Refuser
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void review("ACCEPTED")}
              >
                <Check className="mr-1.5 size-3.5" />
                Accepter
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
