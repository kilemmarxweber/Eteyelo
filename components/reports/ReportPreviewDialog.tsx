"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { SchoolBrandHeader } from "@/components/reports/SchoolBrandHeader";
import type { SchoolReportContext } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

export type ReportPreviewDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Titre de la boîte de dialogue (accessibilité). */
  title: string;
  description?: string;
  /** Contexte branding affiché en tête de l'aperçu. */
  branding?: Pick<
    SchoolReportContext,
    "schoolName" | "address" | "logoUrl" | "academicYearLabel"
  >;
  /** Titre du document dans l'aperçu (sous le branding). */
  documentTitle?: string;
  documentSubtitle?: string;
  /** Méta sous le titre document (badges filtres…). */
  documentMeta?: React.ReactNode;
  children: React.ReactNode;
  /** Actions à droite du pied (ex. Imprimer / Télécharger). */
  actions?: React.ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  /** Simulation feuille A4 portrait (aperçu listes / documents). */
  paper?: "a4" | false;
  className?: string;
  contentClassName?: string;
};

/**
 * Shell d'aperçu rapport : dialog + branding + zone contenu + actions.
 * En mode `paper="a4"`, pas de bandeau UI au-dessus du logo — le document commence directement.
 */
export function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  branding,
  documentTitle,
  documentSubtitle,
  documentMeta,
  children,
  actions,
  size = "lg",
  paper = false,
  className,
  contentClassName,
}: ReportPreviewDialogProps) {
  const sheet = (
    <div className="flex flex-col gap-5">
      {branding ? (
        <SchoolBrandHeader
          context={branding}
          title={documentTitle}
          subtitle={documentSubtitle}
          meta={documentMeta}
        />
      ) : documentTitle ? (
        <h2 className="text-center text-lg font-semibold tracking-tight text-primary">
          {documentTitle}
        </h2>
      ) : null}

      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size={size}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(92dvh,920px)]",
          className,
        )}
      >
        {/* a11y only — évite un second en-tête au-dessus du logo */}
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            paper === "a4"
              ? "bg-muted/50 px-3 py-5 sm:px-8 sm:py-7"
              : "bg-background px-5 py-4 sm:px-6",
            "print:overflow-visible print:bg-transparent print:p-0",
          )}
        >
          {paper === "a4" ? (
            <div
              className={cn(
                "mx-auto w-full max-w-[210mm] bg-background shadow-lg",
                "rounded-md border border-border",
                "px-6 py-8 sm:px-10 sm:py-10",
                "print:max-w-none print:rounded-none print:border-0 print:shadow-none print:p-0",
                contentClassName,
              )}
            >
              {sheet}
            </div>
          ) : (
            <div
              className={cn(
                "flex min-h-0 flex-col gap-4 print:border-0 print:p-0",
                contentClassName,
              )}
            >
              {sheet}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-3 print:hidden sm:justify-between sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fermer
            </Button>
          </DialogClose>
          {actions ? (
            <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
