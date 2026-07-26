/**
 * Compat Next.js 15 : la convention runtime charge encore `middleware.ts`.
 * La logique vit dans `proxy.ts` (nom canonique Next 16 / unit-09).
 * Sous Next 16+, ce fichier peut être supprimé.
 *
 * `config` doit être déclaré ici (pas réexporté) — Next l’analyse statiquement.
 */
export { proxy as middleware } from "./proxy";

export const config = {
  matcher: ["/api/auth/:path*", "/admin", "/admin/:path*"],
};
