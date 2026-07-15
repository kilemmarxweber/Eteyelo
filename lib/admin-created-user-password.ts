/**
 * Mot de passe en clair, réservé au flux admin `createUser` : associé à l’email juste avant l’appel
 * Better Auth, consommé dans `databaseHooks.user.create.after` pour l’email de bienvenue.
 * Mémoire processus uniquement (multi-instances / serverless : prévoir un store partagé si besoin).
 */
export type PendingAdminCreatedCredentials = {
  password: string;
  role?: string;
  organizationName?: string;
  branchName?: string;
  branchPhone?: string;
  branchAddress?: string;
};

type PendingMeta = Omit<PendingAdminCreatedCredentials, "password">;

const pendingByEmail = new Map<string, PendingAdminCreatedCredentials>();

export function stashAdminCreatedUserPlainPassword(
  email: string,
  plainPassword: string,
  meta?: string | PendingMeta,
): void {
  const key = email.trim().toLowerCase();
  const existing = pendingByEmail.get(key);
  const normalized: PendingMeta =
    typeof meta === "string" ? { role: meta } : (meta ?? {});

  pendingByEmail.set(key, {
    password: plainPassword,
    role: normalized.role ?? existing?.role,
    organizationName:
      normalized.organizationName ?? existing?.organizationName,
    branchName: normalized.branchName ?? existing?.branchName,
    branchPhone: normalized.branchPhone ?? existing?.branchPhone,
    branchAddress: normalized.branchAddress ?? existing?.branchAddress,
  });
}

export function consumeAdminCreatedUserPlainPassword(
  email: string,
): PendingAdminCreatedCredentials | undefined {
  const key = email.trim().toLowerCase();
  const value = pendingByEmail.get(key);
  pendingByEmail.delete(key);
  return value;
}
