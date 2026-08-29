"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Camera, Check, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
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
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
    subjectName,
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
        "Demande envoyée. Le directeur / préfet / directeur des études doit valider.",
      );
      onOpenChange(false);
      onSubmitted?.();
    } finally {
      setBusy(false);
    }
  }

  const canEdit = isOpen && !pendingRequestId;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {dateCreated ? `Saisi le ${formatDate(dateCreated)}` : "Cotes élèves"}
              {pendingRequestId
                ? " · modification en attente de validation"
                : isOpen
                  ? " · encore ouvert"
                  : " · validé (lecture seule)"}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[40vh] overflow-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Élève</th>
                      <th className="px-3 py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((note, index) => (
                      <tr key={note.studentId ?? index} className="border-t">
                        <td className="px-3 py-2">{personLabel(note)}</td>
                        <td className="px-3 py-2">
                          {editing && canEdit ? (
                            <Input
                              type="number"
                              className="h-8 w-24"
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
                          ) : (
                            <span className="tabular-nums">
                              {note.score ?? "—"}
                              {note.maxScore != null ? ` / ${note.maxScore}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {askJustification ? (
                <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="grade-justification">
                      Justification écrite *
                    </Label>
                    <Textarea
                      id="grade-justification"
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder="Expliquez pourquoi vous modifiez ces notes…"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Photo / capture *</Label>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
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
                        onClick={() => setCameraOpen(true)}
                      >
                        <Camera className="size-4" />
                        Capturer
                      </Button>
                    </div>
                    {evidencePreview ? (
                      <div className="relative h-28 w-40 overflow-hidden rounded-lg border">
                        <Image
                          src={evidencePreview}
                          alt="Preuve"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {!askJustification && canEdit && !editing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={loading || busy}
              >
                Modifier les cotes
              </Button>
            ) : null}
            {editing && !askJustification ? (
              <Button
                type="button"
                onClick={() => setAskJustification(true)}
                disabled={busy}
              >
                Continuer (justification)
              </Button>
            ) : null}
            {askJustification ? (
              <Button
                type="button"
                onClick={() => void submitModification()}
                disabled={busy}
              >
                {busy ? "Envoi…" : "Envoyer pour validation"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Fermer
            </Button>
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
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Valider la modification de notes</DialogTitle>
          <DialogDescription>
            {row?.contextLabel ?? "Demande enseignant"}
          </DialogDescription>
        </DialogHeader>

        {loading || !row ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Demandeur :</span>{" "}
              {row.requesterName}
            </p>
            <p>
              <span className="text-muted-foreground">Justification :</span>{" "}
              {row.justification}
            </p>
            {row.evidenceUrl ? (
              <div className="relative h-40 w-full max-w-sm overflow-hidden rounded-lg border">
                <Image
                  src={row.evidenceUrl}
                  alt="Preuve"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="max-h-48 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-2 py-1.5">Élève</th>
                    <th className="px-2 py-1.5">Avant</th>
                    <th className="px-2 py-1.5">Après</th>
                  </tr>
                </thead>
                <tbody>
                  {proposed.map((note, index) => {
                    const prev = previous.find(
                      (p) => p.studentId && p.studentId === note.studentId,
                    ) ?? previous[index];
                    return (
                      <tr key={note.studentId ?? index} className="border-t">
                        <td className="px-2 py-1.5">{personLabel(note)}</td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {prev?.score ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums font-medium">
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
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={busy || loading || row?.status !== "PENDING_REVIEW"}
            onClick={() => void review("REJECTED")}
          >
            <X className="size-4" />
            Refuser
          </Button>
          <Button
            type="button"
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
