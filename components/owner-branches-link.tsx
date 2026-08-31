"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { isBranchOwnerSession } from "@/lib/auth/branch-role-access";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";
import { cn } from "@/lib/utils";

/**
 * Lien pour changer d’établissement depuis le header.
 * - Propriétaire d’organisation → liste des branches
 * - Propriétaire de branche (ADMIN) → sélecteur de ses branches
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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isPending) return null;

  const isOrgOwner = isOrganizationOwnerSession(session);
  const isBranchOwner = isBranchOwnerSession(session);
  if (!isOrgOwner && !isBranchOwner) return null;

  const organizationId =
    (typeof params.organizationId === "string"
      ? params.organizationId
      : undefined) ??
    pathname.match(/^\/admin\/organizations\/([^/]+)/)?.[1];

  if (!organizationId) return null;

  const href = isOrgOwner
    ? `/admin/organizations/${organizationId}/branches`
    : `/admin/organizations/${organizationId}/branch-picker`;

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
