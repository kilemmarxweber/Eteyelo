"use client";

import { useRef, useState } from "react";
import { Download, Eye, FilePlus2, FileText, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DocumentReadViewer } from "@/components/documents/document-read-viewer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { uploadDocument } from "@/lib/upload-file";
import {
  addTeacherProfileDocumentAction,
  deleteTeacherProfileDocumentAction,
} from "./teacher-application.action";
import type { TeacherProfileDocument } from "./teacher-profile-types";

export const MAX_COMPLEMENTARY_PDF_BYTES = 4 * 1024 * 1024;

type Props = {
  teacherId: string;
  documents: TeacherProfileDocument[];
  canManage: boolean;
  variant?: "card" | "embedded";
  hint?: string;
};

function complementaryPdfError(file: File): string | null {
  const name = file.name.toLowerCase();
  const isPdf =
    file.type === "application/pdf" ||
    file.type === "application/x-pdf" ||
    name.endsWith(".pdf");
  if (!isPdf) return "Seuls les fichiers PDF sont acceptés.";
  if (file.size > MAX_COMPLEMENTARY_PDF_BYTES) {
    return "Le fichier PDF doit faire moins de 4 Mo.";
  }
  return null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export function TeacherProfileDocuments({
  teacherId,
  documents,
  canManage,
  variant = "card",
  hint,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [viewer, setViewer] = useState<TeacherProfileDocument | null>(null);
  const embedded = variant === "embedded";

  function resetFileInput() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (!next) {
      setFile(null);
      return;
    }
    const error = complementaryPdfError(next);
    if (error) {
      toast.error(error);
      resetFileInput();
      return;
    }
    setFile(next);
  }

  async function addDocument() {
    if (!title.trim() || !file) {
      toast.error("Indiquez le nom du document et sélectionnez un PDF.");
      return;
    }

    const errorMessage = complementaryPdfError(file);
    if (errorMessage) {
      toast.error(errorMessage);
      resetFileInput();
      return;
    }

    setIsPending(true);
    try {
      const uploaded = await uploadDocument(file);
      if (!uploaded.ok) {
        toast.error(uploaded.message);
        return;
      }

      const [result, error] = await addTeacherProfileDocumentAction({
        teacherId,
        title: title.trim(),
        url: uploaded.url,
      });
      if (error || !result?.ok) {
        toast.error(error?.message ?? "Impossible d'ajouter le document.");
        return;
      }

      setTitle("");
      resetFileInput();
      toast.success(result.message);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impossible d'ajouter le document.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function removeDocument(documentId: string) {
    if (!window.confirm("Supprimer ce document du dossier ?")) return;
    setIsPending(true);
    try {
      const [result, error] = await deleteTeacherProfileDocumentAction({
        documentId,
      });
      if (error || !result?.ok) {
        toast.error(error?.message ?? "Impossible de supprimer le document.");
        return;
      }
      toast.success(result.message);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  const addForm = canManage ? (
    <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
      <div className="grid gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`teacher-doc-title-${teacherId}`} className="text-xs">
            Nom du document
          </Label>
          <Input
            id={`teacher-doc-title-${teacherId}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex. Diplôme, attestation…"
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`teacher-doc-file-${teacherId}`} className="text-xs">
            Fichier PDF
          </Label>
          <Input
            ref={fileInputRef}
            id={`teacher-doc-file-${teacherId}`}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFileChange}
            disabled={isPending}
            className="cursor-pointer text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-primary"
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        PDF uniquement, 4 Mo maximum.
        {file ? ` · ${file.name} (${formatFileSize(file.size)})` : ""}
      </p>
      <Button
        type="button"
        onClick={() => void addDocument()}
        disabled={isPending}
        className="w-full gap-2 sm:w-auto"
      >
        <Upload className="size-4" />
        {isPending ? "Ajout…" : "Ajouter le PDF"}
      </Button>
    </div>
  ) : null;

  const list = documents.length ? (
    <div className="divide-y overflow-hidden rounded-lg border">
      {documents.map((document) => (
        <div
          key={document.id}
          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-2">
            <FilePlus2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{document.title}</p>
              <p className="text-[11px] text-muted-foreground">
                Ajouté le {new Date(document.createdAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewer(document)}
            >
              <Eye className="mr-1.5 size-4" />
              Voir
            </Button>
            <Button asChild type="button" variant="ghost" size="sm">
              <a href={document.url} download target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 size-4" />
                Télécharger
              </a>
            </Button>
            {canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => void removeDocument(document.id)}
                disabled={isPending}
                aria-label={`Supprimer ${document.title}`}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      Aucun document complémentaire ajouté.
    </p>
  );

  const body = (
    <div className={cn("space-y-3", !embedded && "p-4")}>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {addForm}
      {list}
    </div>
  );

  return (
    <>
      {embedded ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Documents complémentaires</h3>
            <p className="text-xs text-muted-foreground">
              Diplômes, attestations et justificatifs · PDF de moins de 4 Mo
            </p>
          </div>
          {body}
        </section>
      ) : (
        <Card className="overflow-hidden rounded-xl border-emerald-200/80 bg-gradient-to-b from-emerald-500/[0.07] via-card to-card p-0 shadow-sm dark:border-emerald-900/40">
          <div className="border-b border-emerald-500/10 bg-emerald-500/[0.06] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <FileText className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Documents complémentaires</h3>
                <p className="text-xs text-muted-foreground">
                  Diplômes, attestations et autres justificatifs (PDF)
                </p>
              </div>
            </div>
          </div>
          {body}
        </Card>
      )}

      {viewer ? (
        <DocumentReadViewer
          open
          onOpenChange={(open) => {
            if (!open) setViewer(null);
          }}
          title={viewer.title}
          fileUrl={viewer.url}
        />
      ) : null}
    </>
  );
}
