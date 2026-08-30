export const NOTIFICATIONS_REFRESH_EVENT = "eteyelo-notifications-refresh";
export const MESSAGING_REFRESH_EVENT = "eteyelo-messaging-refresh";
export const MESSAGING_DRAWER_OPEN_EVENT = "eteyelo-messaging-drawer-open";
export const MESSAGING_BROADCAST_CHANNEL = "eteyelo-messaging";

export type MessagingDrawerOpenDetail = {
  conversationId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
};

let messagingChannel: BroadcastChannel | null | undefined;

function getMessagingChannel() {
  if (typeof window === "undefined") return null;
  if (messagingChannel === undefined) {
    try {
      messagingChannel = new BroadcastChannel(MESSAGING_BROADCAST_CHANNEL);
    } catch {
      messagingChannel = null;
    }
  }
  return messagingChannel;
}

/** Demande à la cloche navbar de recharger le compteur (dashboard, inscriptions…). */
export function refreshNotificationBell() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}

/** Actualise le badge du panneau messagerie (sans quitter la page). */
export function refreshMessagingBell() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MESSAGING_REFRESH_EVENT));
  getMessagingChannel()?.postMessage("refresh");
}

/** Ouvre le panneau messagerie sur la page branche courante. */
export function openMessagingDrawer(detail?: MessagingDrawerOpenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<MessagingDrawerOpenDetail>(MESSAGING_DRAWER_OPEN_EVENT, {
      detail: detail ?? {},
    }),
  );
}
