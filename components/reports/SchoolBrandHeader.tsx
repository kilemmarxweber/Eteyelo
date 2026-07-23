"use client";

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SchoolReportContext } from "@/lib/reports/types";

export type SchoolBrandHeaderProps = {
  context: Pick<
    SchoolReportContext,
    "schoolName" | "address" | "logoUrl" | "academicYearLabel"
  >;
  /** Titre du document sous le branding. */
  title?: string;
  subtitle?: string;
  /** Ligne de méta sous le titre (filtres, compteur…). */
  meta?: ReactNode;
  className?: string;
};

function schoolInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * En-tête document : logo à gauche, identité au même niveau.
 * Style lettre d’établissement (aperçu = PDF).
 */
export function SchoolBrandHeader({
  context,
  title,
  subtitle,
  meta,
  className,
}: SchoolBrandHeaderProps) {
  const contactLine = context.address?.trim() || "";
  const initials = schoolInitials(context.schoolName || "É");
  const logoSrc = context.logoUrl?.trim() || undefined;

  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-3 sm:gap-4">
        <Avatar className="size-16 shrink-0 rounded-xl border border-border bg-muted shadow-sm sm:size-20">
          {logoSrc ? (
            <AvatarImage
              src={logoSrc}
              alt={`Logo ${context.schoolName}`}
              className="object-contain p-1.5"
            />
          ) : null}
          <AvatarFallback className="rounded-xl bg-muted text-lg font-semibold tracking-wide text-muted-foreground sm:text-xl">
            {initials || "É"}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-col justify-center gap-0.5 text-left">
          <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {context.schoolName}
          </p>
          {subtitle?.trim() ? (
            <p className="text-sm font-medium text-muted-foreground">
              {subtitle.trim()}
            </p>
          ) : null}
          {contactLine ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {contactLine}
            </p>
          ) : null}
          {context.academicYearLabel ? (
            <p className="text-xs font-medium text-muted-foreground">
              Année scolaire : {context.academicYearLabel}
            </p>
          ) : null}
        </div>
      </div>

      {title ? (
        <div className="flex w-full flex-col items-center gap-3 text-center">
          <Separator />
          <h2 className="text-base font-semibold tracking-tight text-primary sm:text-lg">
            {title}
          </h2>
          {meta ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {meta}
            </div>
          ) : null}
          <Separator />
        </div>
      ) : null}
    </header>
  );
}
