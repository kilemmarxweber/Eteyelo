/** Actions d'écriture : un octroi create / update / delete inclut aussi la lecture. */
export const WRITE_ACTIONS_THAT_INCLUDE_READ = [
  "create",
  "update",
  "delete",
] as const;

export type WriteActionThatIncludesRead =
  (typeof WRITE_ACTIONS_THAT_INCLUDE_READ)[number];

export function writeActionIncludesRead(action: string): boolean {
  return WRITE_ACTIONS_THAT_INCLUDE_READ.includes(
    action.toLowerCase() as WriteActionThatIncludesRead,
  );
}

/**
 * Actions effectives d'un octroi : create / update / delete s'accompagnent
 * toujours de `read`. `read` et `encaisser` restent des octrois autonomes.
 */
export function expandTemporaryGrantActions(action: string): string[] {
  const normalized = action.trim().toLowerCase() || "read";
  if (writeActionIncludesRead(normalized)) {
    return [normalized, "read"];
  }
  return [normalized];
}

/**
 * Sélection multiple d'actions : create/update/delete impliquent déjà la lecture,
 * donc `read` n'est pas persisté en plus. Liste vide → lecture seule.
 */
export function normalizeSelectedGrantActions(actions: string[]): string[] {
  const unique = [
    ...new Set(
      actions.map((action) => action.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  if (unique.some((action) => action === "*")) return [];
  const hasWrite = unique.some((action) => writeActionIncludesRead(action));
  const next = hasWrite ? unique.filter((action) => action !== "read") : unique;
  return next.length ? next : ["read"];
}

export function grantMatchesPermission(
  grant: Pick<{ resource: string; action: string }, "resource" | "action">,
  resource: string,
  action: string,
): boolean {
  const matchResource =
    grant.resource === "*" ||
    grant.resource.toLowerCase() === resource.toLowerCase();
  if (!matchResource) return false;

  if (grant.action === "*") return true;

  const grantAction = grant.action.toLowerCase();
  const requestedAction = action.toLowerCase();
  if (grantAction === requestedAction) return true;

  if (requestedAction === "read" && writeActionIncludesRead(grantAction)) {
    return true;
  }

  // Paiement / caisse : create / update / delete autorisent l'encaissement.
  return (
    requestedAction === "encaisser" &&
    writeActionIncludesRead(grantAction) &&
    (grant.resource === "*" || grant.resource.toLowerCase() === "finance")
  );
}

export function grantsAllowWrite(
  grants: Array<Pick<{ resource: string; action: string }, "resource" | "action">>,
  resource: string,
): boolean {
  return WRITE_ACTIONS_THAT_INCLUDE_READ.some((action) =>
    grants.some((grant) => grantMatchesPermission(grant, resource, action)),
  );
}

export type GrantResourceAction = { resource: string; action: string };

export function formatGrantPair(pair: GrantResourceAction): string {
  return `${pair.resource.trim().toLowerCase()}:${pair.action.trim().toLowerCase()}`;
}

export function isSameGrantPair(
  left: GrantResourceAction,
  right: GrantResourceAction,
): boolean {
  return formatGrantPair(left) === formatGrantPair(right);
}

export function grantBranchScopesOverlap(
  leftBranchId?: string | null,
  rightBranchId?: string | null,
): boolean {
  const left = leftBranchId ?? null;
  const right = rightBranchId ?? null;
  if (left === right) return true;
  return left == null || right == null;
}

/** Retire les paires déjà actives pour le même utilisateur / org (même établissement ou toute l'org). */
export function splitGrantPairsByActiveDuplicates(
  requested: GrantResourceAction[],
  active: Array<GrantResourceAction & { branchId?: string | null }>,
  branchId?: string | null,
): { next: GrantResourceAction[]; duplicates: GrantResourceAction[] } {
  const next: GrantResourceAction[] = [];
  const duplicates: GrantResourceAction[] = [];
  const seenRequested = new Set<string>();

  for (const pair of requested) {
    const key = formatGrantPair(pair);
    if (seenRequested.has(key)) {
      duplicates.push(pair);
      continue;
    }
    seenRequested.add(key);

    const alreadyActive = active.some(
      (grant) =>
        isSameGrantPair(grant, pair) &&
        grantBranchScopesOverlap(grant.branchId, branchId),
    );
    if (alreadyActive) {
      duplicates.push(pair);
    } else {
      next.push(pair);
    }
  }

  return { next, duplicates };
}
