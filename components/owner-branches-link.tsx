"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";
import { cn } from "@/lib/utils";

/**
 * Lien vers la liste des branches — visible pour le propriétaire
 * afin de changer d'établissement depuis le header.
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
  if (!isOrganizationOwnerSession(session)) return null;

  const organizationId =
    (typeof params.organizationId === "string"
      ? params.organizationId
      : undefined) ??
    pathname.match(/^\/admin\/organizations\/([^/]+)/)?.[1];

  if (!organizationId) return null;

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
      <Link
        href={`/admin/organizations/${organizationId}/branches`}
        aria-label="Changer de branche"
        title="Branches"
      >
        <Building2 className="size-4 shrink-0" />
        <span className="hidden text-sm font-medium sm:inline">Branches</span>
      </Link>
    </Button>
  );
}
