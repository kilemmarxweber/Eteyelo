export const ROUTE_LOADER_START_EVENT = "eteyelo:route-loader:start";
export const ROUTE_LOADER_HIDE_EVENT = "eteyelo:route-loader:hide";

export function startRouteLoader() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ROUTE_LOADER_START_EVENT));
}

export function hideRouteLoader() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ROUTE_LOADER_HIDE_EVENT));
}
