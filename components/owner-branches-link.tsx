"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBranchesNavHrefAction } from "@/lib/auth/branches-nav.action";
import {
  canUseOrganizationBranchesList,
  resolveBranchesNavHref,
} from "@/lib/auth/branches-nav";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * Lien pour changer d’établissement depuis le header.
 * - Propriétaire d’organisation / plateforme → liste des branches
 * - Autre rôle rattaché à plusieurs branches → sélecteur (branch-picker)
 *
 * Rendu différé après montage : useSession() peut différer SSR vs client
 * (hydratation).
 */
export function OwnerBranchesLink({
  className,
}: {
  className?: string;
}) {
  const { data: session, isPending } = authClient.useSession();
  const params = useParams();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [fetchedHref, setFetchedHref] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const organizationId =
    (typeof params.organizationId === "string"
      ? params.organizationId
      : undefined) ??
    pathname.match(/^\/admin\/organizations\/([^/]+)/)?.[1];

  const useBranchesList = canUseOrganizationBranchesList(session);
  const ownerHref =
    organizationId && useBranchesList
      ? resolveBranchesNavHref({
          organizationId,
          useBranchesList: true,
          accessibleBranchCount: 0,
        })
      : null;

  useEffect(() => {
    if (!mounted || isPending || !organizationId || !session?.user?.id) {
      setFetchedHref(null);
      return;
    }
    if (useBranchesList) {
      setFetchedHref(null);
      return;
    }

    let cancelled = false;
    void getBranchesNavHrefAction(organizationId).then((nextHref) => {
      if (!cancelled) setFetchedHref(nextHref);
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, isPending, organizationId, session?.user?.id, useBranchesList]);

  if (!mounted || isPending) return null;

  const href = ownerHref ?? fetchedHref;
  if (!href) return null;

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(
        "h-9 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Link href={href} aria-label="Changer de branche" title="Branches">
        <Building2 className="size-4 shrink-0" />
        <span className="hidden text-sm font-medium sm:inline">Branches</span>
      </Link>
    </Button>
  );
}
