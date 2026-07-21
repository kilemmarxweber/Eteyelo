/** Lit un paramètre d'URL côté client sans useSearchParams (évite les mismatches SSR). */
export function readClientSearchParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}
