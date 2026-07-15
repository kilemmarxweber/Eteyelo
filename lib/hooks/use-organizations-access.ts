"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  isArchived?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
};

export type OrganizationsAccess = {
  organizations: OrganizationSummary[];
  canCreate: boolean;
  canDelete: boolean;
  canArchive: boolean;
  canListAll: boolean;
  isPlatformOwner: boolean;
  isOrgManager: boolean;
  roleLabel: string;
  appRole: string;
  membershipRole: string | null;
  membershipOrganizationId: string | null;
};

export type OrganizationDetailAccess = {
  organization: OrganizationSummary;
  canDelete: boolean;
  canArchive: boolean;
  canUpdate: boolean;
  canAccessOwnerSections: boolean;
  canAccessPartenaires: boolean;
  canListAll: boolean;
  roleLabel: string;
  appRole: string;
  membershipRole: string | null;
};

const EMPTY_ACCESS: OrganizationsAccess = {
  organizations: [],
  canCreate: false,
  canDelete: false,
  canArchive: false,
  canListAll: false,
  isPlatformOwner: false,
  isOrgManager: false,
  roleLabel: "Utilisateur",
  appRole: "user",
  membershipRole: null,
  membershipOrganizationId: null,
};

export function useOrganizationsAccess() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [access, setAccess] = useState<OrganizationsAccess | null>(null);
  const [isPending, setIsPending] = useState(true);

  const reload = useCallback(async () => {
    setIsPending(true);
    try {
      const response = await fetch("/api/organizations");
      if (!response.ok) {
        throw new Error("Impossible de charger les organisations.");
      }
      const data = (await response.json()) as OrganizationsAccess;
      setAccess(data);
    } catch {
      setAccess(EMPTY_ACCESS);
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizations() {
      setIsPending(true);
      try {
        const response = await fetch("/api/organizations");
        if (!response.ok) {
          throw new Error("Impossible de charger les organisations.");
        }
        const data = (await response.json()) as OrganizationsAccess;
        if (!cancelled) {
          setAccess(data);
        }
      } catch {
        if (!cancelled) {
          setAccess(EMPTY_ACCESS);
        }
      } finally {
        if (!cancelled) {
          setIsPending(false);
        }
      }
    }

    if (session?.user) {
      void loadOrganizations();
    } else if (!isSessionPending) {
      setAccess(EMPTY_ACCESS);
      setIsPending(false);
    }

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, isSessionPending]);

  return {
    access,
    isPending: isSessionPending || isPending,
    organizations: access?.organizations ?? [],
    canCreate: access?.canCreate ?? false,
    canDelete: access?.canDelete ?? false,
    canArchive: access?.canArchive ?? false,
    isPlatformOwner: access?.isPlatformOwner ?? false,
    isOrgManager: access?.isOrgManager ?? false,
    roleLabel: access?.roleLabel ?? "Utilisateur",
    appRole: access?.appRole ?? "user",
    reload,
  };
}

export function useOrganizationById(organizationId: string | undefined) {
  const [access, setAccess] = useState<OrganizationDetailAccess | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setAccess(null);
      setNotFound(true);
      setIsPending(false);
      return;
    }

    setIsPending(true);
    setNotFound(false);

    try {
      const response = await fetch(`/api/organizations/${organizationId}`);
      if (!response.ok) {
        throw new Error("Organisation introuvable.");
      }
      const data = (await response.json()) as OrganizationDetailAccess;
      setAccess(data);
    } catch {
      setAccess(null);
      setNotFound(true);
    } finally {
      setIsPending(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    organization: access?.organization ?? null,
    canDelete: access?.canDelete ?? false,
    canArchive: access?.canArchive ?? false,
    canUpdate: access?.canUpdate ?? false,
    canAccessOwnerSections: access?.canAccessOwnerSections ?? false,
    canAccessPartenaires: access?.canAccessPartenaires ?? false,
    canListAll: access?.canListAll ?? false,
    roleLabel: access?.roleLabel ?? null,
    appRole: access?.appRole ?? null,
    membershipRole: access?.membershipRole ?? null,
    isPending,
    notFound,
    reload,
  };
}
