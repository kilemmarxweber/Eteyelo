"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
    "schoolName" | "address" | "phone" | "logoUrl" | "academicYearLabel"
  >;
  /** Titre du document dans l'aperçu (sous le branding). */
  documentTitle?: string;
  documentSubtitle?: string;
  children: React.ReactNode;
  /** Actions à droite du pied (ex. Imprimer / Télécharger). */
  actions?: React.ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  className?: string;
  contentClassName?: string;
};

/**
 * Shell d'aperçu rapport : dialog + branding + zone contenu + actions.
 * Non branché à un métier — à composer depuis les écrans d'export.
 */
export function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  branding,
  documentTitle,
  documentSubtitle,
  children,
  actions,
  size = "lg",
  className,
  contentClassName,
}: ReportPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size} className={cn("flex flex-col gap-4", className)}>
        <DialogHeader className="print:hidden">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-md border bg-background p-4 print:overflow-visible print:border-0 print:p-0",
            contentClassName,
          )}
        >
          {branding ? (
            <SchoolBrandHeader
              context={branding}
              title={documentTitle}
              subtitle={documentSubtitle}
            />
          ) : documentTitle ? (
            <h2 className="text-center text-lg font-semibold text-primary">
              {documentTitle}
            </h2>
          ) : null}

          <div className="flex flex-col gap-3">{children}</div>
        </div>

        <DialogFooter className="gap-2 print:hidden sm:justify-between">
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
