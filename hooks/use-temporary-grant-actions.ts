"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { canAccessBranchArea } from "@/lib/auth/branch-area-access";
import type { BranchArea } from "@/lib/auth/branch-area-permissions";
import {
  getStatementsForRole,
  statementsMapFromSession,
} from "@/lib/auth/org-role-permission-shared";
import { roleAllowsAny } from "@/lib/auth/resolve-branch-area-permission";
import {
  canManageOrganization,
  canPermanentlyDeleteInformation,
  getSessionRoles,
} from "@/lib/auth/session-roles";
import {
  grantMatchesPermission,
  grantsAllowWrite,
  grantsCoverBranchArea,
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

function useActiveGrants() {
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

  return { session, isPending, grants, loaded: loaded && !isPending };
}

/** Matrice DAC (session.organization.rolePermissions) pour une ressource. */
function sessionHasDacAction(
  session: unknown,
  resource: string,
  action: string,
): boolean {
  const map = statementsMapFromSession(session);
  for (const slug of getSessionRoles(session)) {
    const statements = getStatementsForRole(slug, map);
    if (roleAllowsAny(statements, resource, [action])) return true;
  }
  return false;
}

/**
 * Entrée dans une zone : DAC (rôle) ou octroi temporaire, comme le menu.
 */
export function useCanAccessBranchArea(area: BranchArea) {
  const { session, isPending, grants, loaded } = useActiveGrants();

  const allowed = useMemo(() => {
    if (canAccessBranchArea(area, session)) return true;
    return grantsCoverBranchArea(grants, area);
  }, [area, grants, session]);

  return {
    allowed,
    ready: loaded && !isPending,
    session,
  };
}

/**
 * Droits d'écriture côté UI : rôle gestionnaire, matrice DAC,
 * ou octroi temporaire create / update / delete.
 */
export function useTemporaryGrantActions(resource: string) {
  const { session, isPending, grants, loaded } = useActiveGrants();
  const roleCanWrite = canManageOrganization(session);
  const roleCanDelete = canPermanentlyDeleteInformation(session);

  return useMemo(() => {
    const dacCreate = sessionHasDacAction(session, resource, "create");
    const dacUpdate = sessionHasDacAction(session, resource, "update");
    const dacDelete = sessionHasDacAction(session, resource, "delete");

    const canCreate =
      roleCanWrite ||
      dacCreate ||
      grants.some((grant) => grantMatchesPermission(grant, resource, "create"));
    const canUpdate =
      roleCanWrite ||
      dacUpdate ||
      grants.some((grant) => grantMatchesPermission(grant, resource, "update"));
    const canDelete =
      roleCanDelete ||
      dacDelete ||
      grants.some((grant) => grantMatchesPermission(grant, resource, "delete"));
    const canWrite =
      roleCanWrite ||
      dacCreate ||
      dacUpdate ||
      dacDelete ||
      grantsAllowWrite(grants, resource) ||
      canDelete;

    return {
      loaded: loaded && !isPending,
      canCreate,
      canUpdate,
      canDelete,
      canWrite,
      canManage: canWrite,
    };
  }, [grants, loaded, isPending, resource, roleCanDelete, roleCanWrite, session]);
}
