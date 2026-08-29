"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Camera,
  Check,
  ClipboardList,
  FilePenLine,
  Lock,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import type { GradeModificationView } from "@/lib/grade-modification-shared";
import { formatFicheInterventionLabel } from "@/lib/grade-modification-shared";
import {
  getFicheScoresAction,
  reviewGradeModificationAction,
  submitGradeModificationAction,
  getGradeModificationAction,
} from "@/lib/actions/grade-modification.actions";
import { cn } from "@/lib/utils";

type NoteRow = {
  studentId?: string;
  nom?: string;
  studentSurname?: string;
  studentusername?: string;
  studentSexe?: string;
  score?: number | null;
  maxScore?: number;
  appreciation?: string;
  comment?: string;
  [key: string]: unknown;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function displaySubjectName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed === trimmed.toUpperCase() && /[A-ZÀ-ÿ]/.test(trimmed)) {
    return trimmed
      .toLocaleLowerCase("fr-FR")
      .replace(/(^|[\s\-'])(\S)/g, (_, sep: string, ch: string) =>
        `${sep}${ch.toLocaleUpperCase("fr-FR")}`,
      );
  }
  return trimmed;
}

function personLabel(note: NoteRow) {
  return (
    [note.nom, note.studentSurname, note.studentusername]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    note.studentId ||
    "Élève"
  );
}

function personInitials(note: NoteRow) {
  const parts = [note.nom, note.studentSurname, note.studentusername]
    .filter(Boolean)
    .map((part) => String(part).trim()[0]?.toUpperCase() ?? "");
  return (parts[0] ?? "") + (parts[1] ?? "") || "?";
}

export function FicheScoresDialog({
  open,
  onOpenChange,
  ficheId,
  sequence,
  subjectName,
  typeFiche,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ficheId: string | null;
  sequence: number;
  subjectName: string;
  typeFiche: string;
  onSubmitted?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [dateCreated, setDateCreated] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [askJustification, setAskJustification] = useState(false);

  const title = formatFicheInterventionLabel({
    typeFiche,
    sequence,
    subjectName: displaySubjectName(subjectName),
  });

  useEffect(() => {
    if (!open || !ficheId) return;
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    setAskJustification(false);
    setJustification("");
    setEvidenceUrl(null);
    setEvidencePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });

    (async () => {
      const [data, err] = await getFicheScoresAction({ ficheId });
      if (cancelled) return;
      if (err || !data) {
        toast.error(err?.message || "Impossible de charger la fiche.");
        onOpenChange(false);
        return;
      }
      setNotes((data.notes as NoteRow[]) ?? []);
      setIsOpen(data.isOpen);
      setDateCreated(data.dateCreated);
      setPendingRequestId(data.pendingRequestId);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, ficheId, onOpenChange]);

  async function handleEvidenceFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error("Image trop volumineuse (max. 5 Mo).");
      return;
    }
    setEvidencePreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setBusy(true);
    try {
      const uploaded = await uploadFile(file);
      if (!uploaded.ok) {
        toast.error(uploaded.message);
        return;
      }
      setEvidenceUrl(uploaded.url);
    } finally {
      setBusy(false);
    }
  }

  async function submitModification() {
    if (!ficheId) return;
    if (justification.trim().length < 8) {
      toast.error("Justification trop courte (8 caractères min.).");
      return;
    }
    if (!evidenceUrl) {
      toast.error("Ajoutez une photo ou une capture.");
      return;
    }
    setBusy(true);
    try {
      const [, err] = await submitGradeModificationAction({
        ficheId,
        justification,
        evidenceUrl,
        proposedNotes: notes,
      });
      if (err) {
        toast.error(err.message || "Envoi impossible.");
        return;
      }
      toast.success(
        "Demande envoyée. Vous serez notifié lorsque la direction aura répondu.",
      );
      onOpenChange(false);
      onSubmitted?.();
    } finally {
      setBusy(false);
    }
  }

  const canEdit = isOpen && !pendingRequestId;
  const statusBadge = pendingRequestId
    ? {
        label: "En attente de validation",
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      }
    : isOpen
      ? {
          label: "Encore ouvert",
          className:
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        }
      : {
          label: "Validé · lecture seule",
          className:
            "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="xl"
          className={cn(
            "!flex h-[min(100dvh-0.75rem,48rem)] !w-[calc(100vw-0.75rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0",
            "sm:h-[min(92dvh,48rem)] sm:!w-[min(100vw-2rem,56rem)]",
          )}
        >
          <DialogHeader className="shrink-0 space-y-2.5 border-b bg-gradient-to-b from-primary/[0.07] to-transparent px-4 pb-3 pt-4 text-left sm:space-y-3 sm:px-6 sm:pb-4 sm:pt-5">
            <div className="flex items-start gap-2.5 pr-7 sm:gap-3 sm:pr-8">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-11">
                <ClipboardList className="size-4 sm:size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                <DialogTitle className="text-balance text-base font-semibold leading-snug tracking-tight sm:text-lg">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-xs leading-relaxed sm:text-sm">
                  {dateCreated
                    ? `Saisi le ${formatDate(dateCreated)}`
                    : "Cotes des élèves"}
                </DialogDescription>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    statusBadge.className,
                  )}
                >
                  {statusBadge.label}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
            {loading ? (
              <div className="space-y-2 py-4 sm:py-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-xl bg-muted/60"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {!canEdit && !pendingRequestId ? (
                  <p className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2.5 text-xs text-sky-800 dark:text-sky-200">
                    <Lock className="mt-0.5 size-3.5 shrink-0" />
                    Fiche validée — consultation uniquement.
                  </p>
                ) : null}
                {pendingRequestId ? (
                  <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                    Une demande de modification est déjà en attente de validation
                    direction.
                  </p>
                ) : null}

                <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 sm:px-3.5 sm:py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                      Élèves
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground sm:text-xs">
                      {notes.length} cote{notes.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <ul className="divide-y">
                    {notes.length === 0 ? (
                      <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Aucune cote enregistrée.
                      </li>
                    ) : (
                      notes.map((note, index) => (
                        <li
                          key={note.studentId ?? index}
                          className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-3.5"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground sm:size-9 sm:text-xs">
                            {personInitials(note)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-snug">
                              {personLabel(note)}
                            </p>
                            {note.appreciation || note.comment ? (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {String(note.appreciation || note.comment)}
                              </p>
                            ) : null}
                          </div>
                          <div className="shrink-0">
                            {editing && canEdit ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  className="h-8 w-16 rounded-lg text-center text-sm font-semibold tabular-nums sm:h-9 sm:w-[4.5rem]"
                                  value={note.score ?? ""}
                                  onChange={(e) => {
                                    const value =
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value);
                                    setNotes((prev) =>
                                      prev.map((row, i) =>
                                        i === index
                                          ? { ...row, score: value }
                                          : row,
                                      ),
                                    );
                                  }}
                                />
                                {note.maxScore != null ? (
                                  <span className="text-xs text-muted-foreground">
                                    / {note.maxScore}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="inline-flex min-w-[2.75rem] justify-end rounded-lg bg-muted/60 px-2 py-1 text-sm font-semibold tabular-nums sm:min-w-[3.25rem] sm:px-2.5 sm:py-1.5">
                                {note.score ?? "—"}
                                {note.maxScore != null ? (
                                  <span className="font-normal text-muted-foreground">
                                    /{note.maxScore}
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                {askJustification ? (
                  <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 sm:rounded-2xl sm:p-4">
                    <div>
                      <p className="text-sm font-semibold">
                        Justification obligatoire
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Le directeur, le préfet ou le directeur des études
                        validera avant application.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="grade-justification">
                        Motif écrit *
                      </Label>
                      <Textarea
                        id="grade-justification"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="Expliquez pourquoi vous modifiez ces notes…"
                        rows={3}
                        className="resize-none bg-background text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Photo ou capture *</Label>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted/50 sm:flex-none">
                          <Upload className="size-4" />
                          Importer
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleEvidenceFile(file);
                            }}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 flex-1 sm:flex-none"
                          onClick={() => setCameraOpen(true)}
                        >
                          <Camera className="size-4" />
                          Capturer
                        </Button>
                      </div>
                      {evidencePreview ? (
                        <div className="relative mx-auto h-36 w-full max-w-xs overflow-hidden rounded-xl border bg-muted/30 sm:mx-0 sm:h-32 sm:max-w-[14rem]">
                          <Image
                            src={evidencePreview}
                            alt="Preuve"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Aucune image jointe pour le moment.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 !flex-col gap-2 border-t bg-muted/20 px-4 py-3 sm:!flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-6 sm:py-3.5">
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full sm:order-first sm:h-9 sm:w-auto"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Fermer
            </Button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {!askJustification && !editing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full gap-2 sm:h-9 sm:w-auto"
                  onClick={() => setEditing(true)}
                  disabled={loading || busy || !canEdit}
                  title={
                    !isOpen
                      ? "Fiche validée — modification impossible"
                      : pendingRequestId
                        ? "Une demande est déjà en attente"
                        : "Modifier les cotes"
                  }
                >
                  {!isOpen ? (
                    <Lock className="size-4" />
                  ) : (
                    <Pencil className="size-4" />
                  )}
                  Modifier les cotes
                </Button>
              ) : null}
              {editing && canEdit && !askJustification ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-full sm:h-9 sm:w-auto"
                    onClick={() => setEditing(false)}
                    disabled={busy}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    className="h-10 w-full sm:h-9 sm:w-auto"
                    onClick={() => setAskJustification(true)}
                    disabled={busy}
                  >
                    Continuer
                  </Button>
                </>
              ) : null}
              {askJustification && canEdit ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-full sm:h-9 sm:w-auto"
                    onClick={() => setAskJustification(false)}
                    disabled={busy}
                  >
                    Retour
                  </Button>
                  <Button
                    type="button"
                    className="h-10 w-full sm:h-9 sm:w-auto"
                    onClick={() => void submitModification()}
                    disabled={busy || !isOpen}
                  >
                    {busy ? "Envoi…" : "Envoyer pour validation"}
                  </Button>
                </>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          setCameraOpen(false);
          void handleEvidenceFile(file);
        }}
        title="Capture pour justification"
      />
    </>
  );
}

export function GradeModificationDecisionDialog({
  open,
  onOpenChange,
  requestId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
  onDone?: () => void;
}) {
  const [row, setRow] = useState<GradeModificationView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !requestId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [data, err] = await getGradeModificationAction({ requestId });
      if (cancelled) return;
      if (err || !data) {
        toast.error(err?.message || "Notification introuvable.");
        onOpenChange(false);
        return;
      }
      setRow(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, requestId, onOpenChange]);

  const accepted = row?.status === "ACCEPTED";
  const rejected = row?.status === "REJECTED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className={cn(
          "!flex h-auto max-h-[min(100dvh-0.75rem,36rem)] !w-[calc(100vw-0.75rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0",
          "sm:max-h-[min(92dvh,40rem)] sm:!w-[min(100vw-2rem,56rem)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-2.5 border-b bg-gradient-to-b from-primary/[0.07] to-transparent px-4 pb-3 pt-4 text-left sm:space-y-3 sm:px-6 sm:pb-4 sm:pt-5">
          <div className="flex items-start gap-2.5 pr-7 sm:gap-3 sm:pr-8">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm sm:size-11",
                accepted && "bg-emerald-600",
                rejected && "bg-rose-600",
                !accepted && !rejected && "bg-primary",
              )}
            >
              {accepted ? (
                <Check className="size-4 sm:size-5" />
              ) : rejected ? (
                <X className="size-4 sm:size-5" />
              ) : (
                <FilePenLine className="size-4 sm:size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
              <DialogTitle className="text-balance text-base font-semibold leading-snug tracking-tight sm:text-lg">
                {loading
                  ? "Réponse direction"
                  : accepted
                    ? "Modification acceptée"
                    : rejected
                      ? "Modification refusée"
                      : "Réponse direction"}
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed sm:text-sm">
                {row?.contextLabel
                  ? displaySubjectName(row.contextLabel)
                  : "Résultat de votre demande de modification de notes."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {loading || !row ? (
            <div className="space-y-2 py-2">
              <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
              <div className="h-10 animate-pulse rounded-xl bg-muted/60" />
            </div>
          ) : (
            <div className="space-y-4">
              <p
                className={cn(
                  "rounded-2xl border px-4 py-4 text-sm font-medium leading-relaxed sm:text-base",
                  accepted &&
                    "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-200",
                  rejected &&
                    "border-rose-500/25 bg-rose-500/[0.08] text-rose-800 dark:text-rose-200",
                  !accepted &&
                    !rejected &&
                    "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                {accepted
                  ? "La direction a accepté votre demande. Les notes ont été mises à jour."
                  : rejected
                    ? "La direction a refusé votre demande. Aucun changement n’a été appliqué."
                    : "Votre demande est encore en cours de traitement."}
              </p>
              {row.reviewComment ? (
                <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Commentaire
                  </p>
                  <p className="mt-1.5 leading-relaxed text-foreground">
                    {row.reviewComment}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 !flex-col gap-2 border-t bg-muted/20 px-4 py-3 sm:!flex-row sm:justify-end sm:space-x-0 sm:px-6 sm:py-3.5">
          <Button
            type="button"
            className="h-10 w-full sm:h-9 sm:min-w-[8rem] sm:w-auto"
            disabled={loading}
            onClick={() => {
              onOpenChange(false);
              onDone?.();
            }}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GradeModificationReviewDialog({
  open,
  onOpenChange,
  requestId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
  onDone?: () => void;
}) {
  const [row, setRow] = useState<GradeModificationView | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !requestId) return;
    let cancelled = false;
    setLoading(true);
    setComment("");
    (async () => {
      const [data, err] = await getGradeModificationAction({ requestId });
      if (cancelled) return;
      if (err || !data) {
        toast.error(err?.message || "Demande introuvable.");
        onOpenChange(false);
        return;
      }
      setRow(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, requestId, onOpenChange]);

  const proposed = useMemo(() => {
    try {
      return JSON.parse(row?.proposedNotes ?? "[]") as NoteRow[];
    } catch {
      return [];
    }
  }, [row?.proposedNotes]);

  const previous = useMemo(() => {
    try {
      return JSON.parse(row?.previousNotes ?? "[]") as NoteRow[];
    } catch {
      return [];
    }
  }, [row?.previousNotes]);

  async function review(decision: "ACCEPTED" | "REJECTED") {
    if (!requestId) return;
    setBusy(true);
    try {
      const [, err] = await reviewGradeModificationAction({
        requestId,
        decision,
        comment: comment || undefined,
      });
      if (err) {
        toast.error(err.message || "Décision impossible.");
        return;
      }
      toast.success(
        decision === "ACCEPTED"
          ? "Modification appliquée."
          : "Modification refusée — aucun changement.",
      );
      onOpenChange(false);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className={cn(
          "!flex h-[min(100dvh-0.75rem,48rem)] !w-[calc(100vw-0.75rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0",
          "sm:h-[min(92dvh,48rem)] sm:!w-[min(100vw-2rem,56rem)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b bg-gradient-to-b from-primary/[0.07] to-transparent px-4 pb-3 pt-4 text-left sm:px-6 sm:pb-4 sm:pt-5">
          <DialogTitle className="pr-7 text-base font-semibold tracking-tight sm:pr-8 sm:text-lg">
            Valider la modification de notes
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {row?.contextLabel
              ? displaySubjectName(row.contextLabel)
              : "Demande enseignant"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
          {loading || !row ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-xl bg-muted/60"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm sm:space-y-4">
              <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:rounded-2xl sm:p-3.5">
                <p>
                  <span className="text-muted-foreground">Demandeur :</span>{" "}
                  <span className="font-medium">{row.requesterName}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Justification :</span>{" "}
                  {row.justification}
                </p>
              </div>
              {row.evidenceUrl ? (
                <div className="relative h-40 w-full overflow-hidden rounded-xl border bg-muted/20 sm:h-44 sm:rounded-2xl">
                  <Image
                    src={row.evidenceUrl}
                    alt="Preuve"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : null}
              <div className="overflow-x-auto overflow-y-hidden rounded-xl border sm:rounded-2xl">
                <table className="w-full min-w-[18rem] text-xs">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Élève</th>
                      <th className="px-3 py-2.5 font-medium">Avant</th>
                      <th className="px-3 py-2.5 font-medium">Après</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposed.map((note, index) => {
                      const prev =
                        previous.find(
                          (p) =>
                            p.studentId && p.studentId === note.studentId,
                        ) ?? previous[index];
                      const changed =
                        (prev?.score ?? null) !== (note.score ?? null);
                      return (
                        <tr key={note.studentId ?? index} className="border-t">
                          <td className="px-3 py-2.5">{personLabel(note)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                            {prev?.score ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2.5 tabular-nums font-semibold",
                              changed && "text-primary",
                            )}
                          >
                            {note.score ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Commentaire (optionnel)"
                rows={2}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 !flex-col gap-2 border-t bg-muted/20 px-4 py-3 sm:!flex-row sm:justify-end sm:space-x-0 sm:px-6 sm:py-3.5">
          <Button
            type="button"
            variant="destructive"
            className="h-10 w-full sm:h-9 sm:w-auto"
            disabled={busy || loading || row?.status !== "PENDING_REVIEW"}
            onClick={() => void review("REJECTED")}
          >
            <X className="size-4" />
            Refuser
          </Button>
          <Button
            type="button"
            className="h-10 w-full sm:h-9 sm:w-auto"
            disabled={busy || loading || row?.status !== "PENDING_REVIEW"}
            onClick={() => void review("ACCEPTED")}
          >
            <Check className="size-4" />
            Accepter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
