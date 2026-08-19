import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

interface AuthShellProps {
  mode: AuthMode;
  children: ReactNode;
  className?: string;
}

const panelCopy: Record<
  AuthMode,
  {
    badge: string;
    title: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    quote: string;
  }
> = {
  "sign-in": {
    badge: "KLAMBOCORE",
    title: "Nouveau sur la plateforme ?",
    description:
      "Créez votre compte et gérez inscriptions, notes, présences et paiements depuis un seul espace.",
    ctaLabel: "Créer un compte",
    ctaHref: "/auth/sign-up",
    quote: "Digitaliser l'éducation, une école à la fois.",
  },
  "sign-up": {
    badge: "KLAMBOCORE",
    title: "Déjà un compte ?",
    description:
      "Reconnectez-vous pour reprendre la gestion de votre établissement scolaire.",
    ctaLabel: "Se connecter",
    ctaHref: "/auth/sign-in",
    quote: "Chaque élève mérite un suivi attentif.",
  },
};

/** Écran auth split : formulaire + panneau promotionnel (style HK+). */
export function AuthShell({ mode, children, className }: AuthShellProps) {
  const panel = panelCopy[mode];

  return (
    <div
      className={cn(
        "klambocore-auth relative flex min-h-svh items-center justify-center overflow-x-hidden bg-background px-3 py-5 sm:px-6 sm:py-8",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--primary)_18%,transparent),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_color-mix(in_oklab,var(--primary)_8%,transparent),_transparent_40%)]"
      />

      <div className="relative z-10 w-full max-w-[26.5rem] overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/50 sm:max-w-xl md:max-w-4xl md:grid md:grid-cols-[1.05fr_0.95fr] md:rounded-[1.5rem]">
        <div className="bg-card px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
          {children}
        </div>

        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-blue-950 p-6 text-white md:flex md:flex-col md:justify-between lg:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full bg-black/20"
          />

          <div className="relative space-y-4">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 w-8 rounded-full",
                    i === 0 ? "bg-white" : "bg-white/35",
                  )}
                />
              ))}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm">
              <GraduationCap className="size-3.5" aria-hidden />
              {panel.badge}
            </div>

            <div className="max-w-4xl space-y-3 pt-1">
              <h2 className="text-balance text-3xl font-bold tracking-tight lg:text-4xl">
                {panel.title}
              </h2>
              <p className="max-w-4xl text-base leading-relaxed text-white/90 lg:text-lg">
                {panel.description}
              </p>
            </div>

            <Link
              href={panel.ctaHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/80 bg-transparent px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {panel.ctaLabel}
            </Link>
          </div>

          <p className="relative mt-6 text-sm text-white/80 italic">
            “{panel.quote}”
          </p>
        </aside>
      </div>
    </div>
  );
}
