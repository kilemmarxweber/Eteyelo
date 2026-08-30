"use client";

import { useEffect, useRef } from "react";

import {
  MESSAGING_BROADCAST_CHANNEL,
  MESSAGING_REFRESH_EVENT,
} from "@/lib/notification-events";

/**
 * Recharge la messagerie uniquement à l'écoute :
 * nouvel événement local, autre onglet, retour sur l'onglet, reconnexion.
 * Aucun intervalle de polling.
 */
export function useMessagingRefreshListener(
  onRefresh: () => void,
  enabled = true,
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    let debounceTimer: number | null = null;
    const run = () => {
      if (document.visibilityState === "hidden") return;
      if (debounceTimer != null) return;
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        onRefreshRef.current();
      }, 250);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener(MESSAGING_REFRESH_EVENT, run);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(MESSAGING_BROADCAST_CHANNEL);
      channel.onmessage = () => run();
    } catch {
      channel = null;
    }

    return () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      window.removeEventListener(MESSAGING_REFRESH_EVENT, run);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, [enabled]);
}
