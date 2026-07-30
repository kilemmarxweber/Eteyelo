"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DevoirsShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  /** Lien retour liste (détail / nouveau) — affiche aussi le bouton Retour. */
  listHref?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Cadre Devoirs : padding Layout + en-tête sticky compact
 * (même hauteur visuelle liste / détail).
 */
export function DevoirsShell({
  title,
  description,
  actions,
  badge,
  listHref,
  children,
  className,
}: DevoirsShellProps) {
  return (
    <Layout>
      <LayoutBody className={cn("flex flex-col gap-0 pt-0 md:pt-0", className)}>
        <div
          className={cn(
            "sticky top-0 z-20 -mx-4 bg-background/95 backdrop-blur",
            "supports-[backdrop-filter]:bg-background/80",
            "md:-mx-8",
          )}
        >
          <header className="px-4 py-2 md:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {listHref ? (
                  <Button
                    asChild
                    size="icon"
                    variant="outline"
                    className="size-7 shrink-0"
                  >
                    <Link href={listHref} aria-label="Retour aux devoirs">
                      <ArrowLeft className="size-3.5" />
                    </Link>
                  </Button>
                ) : null}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <h1 className="truncate text-base font-bold tracking-tight text-foreground md:text-lg">
                      {title}
                    </h1>
                    {badge}
                  </div>
                  {description ? (
                    <p className="truncate text-xs leading-snug text-muted-foreground md:text-sm">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:pl-2">
                  {actions}
                </div>
              ) : null}
            </div>
          </header>
          <div className="h-3 bg-background" aria-hidden />
        </div>

        <div className="min-w-0 space-y-4 pb-4 pt-1">{children}</div>
      </LayoutBody>
    </Layout>
  );
}
