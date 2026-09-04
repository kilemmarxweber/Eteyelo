"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth-client";
import {
  canManageOrganization,
  canPermanentlyDeleteInformation,
} from "@/lib/auth/session-roles";
import {
  grantMatchesPermission,
  grantsAllowWrite,
} from "@/lib/auth/temporary-grant-actions";
import { getMyActiveTemporaryGrantsAction } from "@/lib/auth/temporary-grants.action";

type GrantLite = { resource: string; action: string };

const CACHE_TTL_MS = 8_000;
const grantCache = new Map<string, { grants: GrantLite[]; at: number }>();
const grantInflight = new Map<string, Promise<GrantLite[]>>();

function cacheKey(organizationId: string, branchId: string | null) {
  return `${organizationId}:${branchId ?? ""}`;
}

async function loadActiveGrants(
  organizationId: string,
  branchId: string | null,
): Promise<GrantLite[]> {
  const key = cacheKey(organizationId, branchId);
  const hit = grantCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.grants;
  }

  let pending = grantInflight.get(key);
  if (!pending) {
    pending = getMyActiveTemporaryGrantsAction(organizationId, branchId).then(
      (res) => {
        const grants = res.grants.map((grant) => ({
          resource: grant.resource,
          action: grant.action,
        }));
        grantCache.set(key, { grants, at: Date.now() });
        grantInflight.delete(key);
        return grants;
      },
    );
    grantInflight.set(key, pending);
  }
  return pending;
}

/**
 * Droits d'écriture côté UI : rôle gestionnaire, ou octroi temporaire
 * create / update / delete sur la ressource du catalogue.
 */
export function useTemporaryGrantActions(resource: string) {
  const { data: session, isPending } = useSession();
  const [grants, setGrants] = useState<GrantLite[]>([]);
  const [loaded, setLoaded] = useState(false);

  const organizationId =
    session?.organization?.id ??
    (session as { session?: { activeOrganizationId?: string } } | null)?.session
      ?.activeOrganizationId ??
    null;
  const branchId =
    session?.branch?.id ??
    (session as { session?: { activeBranchId?: string } } | null)?.session
      ?.activeBranchId ??
    null;

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) {
      setGrants([]);
      setLoaded(!isPending);
      return;
    }

    void loadActiveGrants(organizationId, branchId).then((next) => {
      if (cancelled) return;
      setGrants(next);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [organizationId, branchId, isPending]);

  const roleCanWrite = canManageOrganization(session);
  const roleCanDelete = canPermanentlyDeleteInformation(session);

  return useMemo(() => {
    const canCreate =
      roleCanWrite ||
      grants.some((grant) => grantMatchesPermission(grant, resource, "create"));
    const canUpdate =
      roleCanWrite ||
      grants.some((grant) => grantMatchesPermission(grant, resource, "update"));
    const canDelete =
      roleCanDelete ||
      grants.some((grant) => grantMatchesPermission(grant, resource, "delete"));
    const canWrite = roleCanWrite || grantsAllowWrite(grants, resource) || canDelete;

    return {
      loaded: loaded && !isPending,
      canCreate,
      canUpdate,
      canDelete,
      canWrite,
      canManage: canWrite,
    };
  }, [grants, loaded, isPending, resource, roleCanDelete, roleCanWrite]);
}
