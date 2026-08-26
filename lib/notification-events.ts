export const NOTIFICATIONS_REFRESH_EVENT = "eteyelo-notifications-refresh";

/** Demande à la cloche navbar de recharger le compteur (dashboard, inscriptions…). */
export function refreshNotificationBell() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}
