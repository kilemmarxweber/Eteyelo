import { cn } from "@/lib/utils";

type PageLoaderTone = "app" | "tv";

export function PageLoader({
  tone = "app",
  className,
  "aria-label": ariaLabel = "Chargement",
}: {
  tone?: PageLoaderTone;
  className?: string;
  "aria-label"?: string;
}) {
  const isTv = tone === "tv";

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden",
        isTv
          ? "min-h-svh bg-[#06101f]"
          : "min-h-[min(100%,24rem)] bg-transparent",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {isTv ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(56,189,248,0.14),transparent_55%),radial-gradient(ellipse_at_80%_70%,rgba(16,185,129,0.1),transparent_50%)]" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_62%)]" />
      )}
      <div
        className={cn(
          "relative z-10 size-11 rounded-full border-2",
          isTv ? "border-sky-200/20" : "border-primary/15",
        )}
      >
        <div
          className={cn(
            "page-loader-ring absolute inset-[-2px] rounded-full border-2 border-transparent",
            isTv ? "border-t-sky-300/85" : "border-t-primary",
          )}
        />
      </div>
    </div>
  );
}
