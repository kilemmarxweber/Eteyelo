import type { SchoolNotifyChannel } from "@/lib/notify/deliver-school-notify";

/** Libellé UI pour le canal mobile réellement utilisé. */
export function mobileChannelLabel(
  channel?: SchoolNotifyChannel | string | null,
): string {
  if (channel === "klambo") return "Klambo Inbox";
  if (channel === "whatsapp") return "WhatsApp";
  return "Klambo Inbox / WhatsApp";
}

/** Toast court : email + canal mobile. */
export function emailAndMobileToast(
  channel?: SchoolNotifyChannel | string | null,
): string {
  return `email et ${mobileChannelLabel(channel)}`;
}
