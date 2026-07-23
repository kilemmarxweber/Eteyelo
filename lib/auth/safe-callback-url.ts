/** Callback interne sûr (chemins relatifs uniquement). */
export function safeInternalCallbackUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

export function buildChangePasswordUrl(callbackUrl?: string | null): string {
  const safe = safeInternalCallbackUrl(callbackUrl);
  if (!safe) return "/auth/change-password";
  return `/auth/change-password?callbackUrl=${encodeURIComponent(safe)}`;
}
