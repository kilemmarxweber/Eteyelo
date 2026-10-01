import { formatNotifyCardPreview } from "@/lib/notify/notify-message-card";

export const MESSAGING_MAX_BODY_LENGTH = 4000;
export const MESSAGING_MAX_SUBJECT_LENGTH = 120;
export const MESSAGING_MAX_RECIPIENTS = 50;
/** Nombre max d'admins par groupe (créateur inclus). */
export const MESSAGING_MAX_GROUP_ADMINS = 5;
export const MESSAGING_RATE_LIMIT_PER_MINUTE = 20;
export const MESSAGING_SEARCH_PAGE_SIZE = 20;
export const MESSAGING_CONVERSATIONS_PAGE_SIZE = 30;
export const MESSAGING_MESSAGES_PAGE_SIZE = 40;
export const MESSAGING_PURGE_CONFIRMATION = "NETTOYER";
const SATISFACTION_PREFIX = "__SATISFACTION__:";

export type ConversationTypeValue = "DIRECT" | "GROUP" | "CONTEXTUAL";
export type ConversationParticipantRoleValue = "ADMIN" | "MEMBER";
export type ConversationContextTypeValue =
  | "ABSENCE_CASE"
  | "GRADE_MODIFICATION"
  | "REGISTRATION_REQUEST"
  | "SUPPORT_TICKET";

export type MessagingFilter = "all" | "unread" | "groups" | "direct" | "archived";

export type MessagingRecipient = {
  userId: string;
  memberId: string;
  name: string;
  image: string | null;
  telephone?: string | null;
  prenom?: string | null;
  role: string;
  roleLabel: string;
  branches: Array<{ id: string; name: string }>;
};

export type ConversationListItem = {
  id: string;
  type: ConversationTypeValue;
  subject: string | null;
  contextType: ConversationContextTypeValue | null;
  contextId: string | null;
  contextHref: string | null;
  updatedAt: string;
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  archived: boolean;
  muted: boolean;
  /** Conversation avec le bot notifications école — pas de réponse possible. */
  noReply: boolean;
  /** Groupe : seuls les admins peuvent écrire. */
  repliesLocked: boolean;
  /** Rôle de l'utilisateur courant dans le groupe (null hors groupe). */
  myRole: ConversationParticipantRoleValue | null;
  /** Nombre d'admins actifs (GROUP). */
  adminCount: number;
  participants: Array<{
    userId: string;
    name: string;
    image: string | null;
    telephone?: string | null;
    prenom?: string | null;
    roleLabel: string;
    /** Rôle dans le groupe (ADMIN/MEMBER), pas le rôle org. */
    groupRole?: ConversationParticipantRoleValue;
    branches: Array<{ id: string; name: string }>;
  }>;
  title: string;
};

export type MessageView = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  senderRoleLabel: string;
  senderBranches: Array<{ id: string; name: string }>;
  body: string;
  replyTo: {
    id: string;
    senderName: string;
    body: string;
    deletedAt?: string | null;
  } | null;
  attachments: Array<{
    id: string;
    kind: string;
    url: string;
    mimeType: string | null;
    sizeBytes: number | null;
    durationMs: number | null;
    fileName: string | null;
  }>;
  createdAt: string;
  editedAt: string | null;
  /** Présent si le message a été retiré pour tout le monde. */
  deletedAt: string | null;
  archivedForMe: boolean;
};

/** Libellé affiché à la place d'un message retiré. */
export const MESSAGE_DELETED_LABEL = "Ce message a été retiré";

export function formatMessagingPersonName(user: {
  prenom?: string | null;
  name?: string | null;
  postnom?: string | null;
} | null | undefined) {
  if (!user) return "Utilisateur";
  return (
    [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim() ||
    user.name ||
    "Utilisateur"
  );
}

export function sanitizeMessageBody(raw: string) {
  const trimmed = raw.trim();
  // Payloads structurés (appels / cartes notif) : ne pas aplatir ni stripper le JSON.
  if (
    trimmed.startsWith("__CALL__:") ||
    trimmed.startsWith("__NOTIFY__:") ||
    trimmed.startsWith(SATISFACTION_PREFIX)
  ) {
    return trimmed.slice(0, MESSAGING_MAX_BODY_LENGTH);
  }
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function previewMessageBody(body: string, max = 80) {
  if (body.trimStart().startsWith("__NOTIFY__:")) {
    return formatNotifyCardPreview(body, max);
  }
  if (body.trimStart().startsWith(SATISFACTION_PREFIX)) {
    const preview = formatSatisfactionPreview(body);
    return preview.length <= max ? preview : `${preview.slice(0, max - 1)}…`;
  }
  const text = formatCallTracePreview(body).trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function previewDeletedOrBody(
  body: string,
  deletedAt: Date | string | null | undefined,
  max = 80,
) {
  if (deletedAt) return MESSAGE_DELETED_LABEL;
  return previewMessageBody(body, max);
}

/** Aperçu lisible des traces d'appel stockées en `__CALL__:{json}`. */
export function formatCallTracePreview(body: string) {
  if (!body.startsWith("__CALL__:")) return body;
  try {
    const data = JSON.parse(body.slice("__CALL__:".length)) as {
      kind?: string;
      status?: string;
      endReason?: string | null;
      durationMs?: number;
    };
    const video = data.kind === "VIDEO";
    const label = video ? "Appel vidéo" : "Appel audio";
    if (data.status === "REJECTED") return `${label} · refusé`;
    if (data.status === "MISSED" || data.endReason === "missed") {
      return `${label} · manqué`;
    }
    if (data.endReason === "cancelled") return `${label} · annulé`;
    const ms = Number(data.durationMs ?? 0);
    if (ms > 0) {
      const totalSec = Math.round(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${label} · ${m}:${String(s).padStart(2, "0")}`;
    }
    return label;
  } catch {
    return "Appel";
  }
}

function formatSatisfactionPreview(body: string) {
  try {
    const payload = JSON.parse(
      body.trimStart().slice(SATISFACTION_PREFIX.length),
    ) as {
      label?: string;
      items?: Array<{ status?: string }>;
    };
    const total = Array.isArray(payload.items) ? payload.items.length : 0;
    const pending = Array.isArray(payload.items)
      ? payload.items.filter((item) => item?.status !== "done").length
      : 0;
    if (pending > 0) {
      return `Avis du mois à compléter · ${pending}/${total || pending}`;
    }
    if (total > 0) {
      return `Avis du mois validé · ${total} établissement(s)`;
    }
    return payload.label
      ? `Avis parent · ${payload.label}`
      : "Avis parent mensuel";
  } catch {
    return "Avis parent mensuel";
  }
}
