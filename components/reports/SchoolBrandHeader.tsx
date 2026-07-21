"use client";

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SchoolReportContext } from "@/lib/reports/types";

export type SchoolBrandHeaderProps = {
  context: Pick<
    SchoolReportContext,
    "schoolName" | "address" | "phone" | "logoUrl" | "academicYearLabel"
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
 * En-tête document : logo centré en premier, identité, titre.
 * Style lettre d’établissement (aperçu = PDF).
 */
export function SchoolBrandHeader({
  context,
  title,
  subtitle,
  meta,
  className,
}: SchoolBrandHeaderProps) {
  const contactLine = [context.address, context.phone]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  const initials = schoolInitials(context.schoolName || "É");
  const logoSrc = context.logoUrl?.trim() || undefined;

  return (
    <header className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <Avatar className="size-24 rounded-xl border border-border bg-muted shadow-sm sm:size-28">
        {logoSrc ? (
          <AvatarImage
            src={logoSrc}
            alt={`Logo ${context.schoolName}`}
            className="object-contain p-2"
          />
        ) : null}
        <AvatarFallback className="rounded-xl bg-muted text-xl font-semibold tracking-wide text-muted-foreground sm:text-2xl">
          {initials || "É"}
        </AvatarFallback>
      </Avatar>

      <div className="flex w-full max-w-xl flex-col items-center gap-1">
        <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
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

      {title ? (
        <div className="flex w-full flex-col items-center gap-3">
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
