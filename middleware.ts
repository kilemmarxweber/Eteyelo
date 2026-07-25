/**
 * Compat Next.js 15 : la convention runtime charge encore `middleware.ts`.
 * La logique vit dans `proxy.ts` (nom canonique Next 16 / unit-09).
 * Sous Next 16+, ce fichier peut être supprimé.
 */
export { proxy as middleware, config } from "./proxy";
