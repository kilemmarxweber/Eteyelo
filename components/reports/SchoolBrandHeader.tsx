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
  className?: string;
};

/**
 * En-tête HTML d'aperçu : logo + établissement + adresse (+ titre optionnel).
 */
export function SchoolBrandHeader({
  context,
  title,
  subtitle,
  className,
}: SchoolBrandHeaderProps) {
  const contactLine = [context.address, context.phone]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start gap-4">
        {context.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URLs logo dynamiques (uploads / http / data)
          <img
            src={context.logoUrl}
            alt={`Logo ${context.schoolName}`}
            className="size-14 shrink-0 rounded-md bg-muted object-contain p-1"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-1 text-center sm:text-left">
          <p className="truncate text-base font-semibold text-foreground">
            {context.schoolName}
          </p>
          {subtitle?.trim() ? (
            <p className="truncate text-sm text-muted-foreground">
              {subtitle.trim()}
            </p>
          ) : null}
          {contactLine ? (
            <p className="text-xs text-muted-foreground">{contactLine}</p>
          ) : null}
          {context.academicYearLabel ? (
            <p className="text-xs text-muted-foreground">
              Année scolaire : {context.academicYearLabel}
            </p>
          ) : null}
        </div>
      </div>

      {title ? (
        <>
          <Separator />
          <h2 className="text-center text-lg font-semibold text-primary">
            {title}
          </h2>
        </>
      ) : null}
    </header>
  );
}
