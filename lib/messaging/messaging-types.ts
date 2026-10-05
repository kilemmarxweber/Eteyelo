import { formatNotifyCardPreview } from "@/lib/notify/notify-message-card";

export const MESSAGING_MAX_BODY_LENGTH = 4000;
/** Enveloppe `k1.` (base64url). Le clair reste plafonné à 4000. */
export const MESSAGING_MAX_CIPHER_LENGTH = 22000;
export const ENCRYPTED_MESSAGE_PREVIEW = "Message";
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
  /** Numéro du compte, comme le rôle sur la fiche contact. */
  telephone?: string | null;
  prenom?: string | null;
  nom?: string | null;
  postnom?: string | null;
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
    /** Numéro du compte, comme le rôle. */
    telephone?: string | null;
    prenom?: string | null;
    nom?: string | null;
    postnom?: string | null;
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
  senderPrenom?: string | null;
  senderNom?: string | null;
  senderPostnom?: string | null;
  /** Numéro du compte de l'expéditeur. */
  senderTelephone?: string | null;
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
  /** Statut d'envoi pour les messages de l'acteur (SENT | READ). */
  deliveryStatus?: "SENT" | "READ";
};

/** Libellé affiché à la place d'un message retiré. */
export const MESSAGE_DELETED_LABEL = "Ce message a été retiré";

function stripToken(value: string, token: string, edge: "start" | "end") {
  const piece = token.trim();
  let rest = value.trim();
  if (!piece || !rest) return rest;
  const folded = (input: string) => input.toLocaleLowerCase("fr");
  if (edge === "start") {
    const prefix = `${folded(piece)} `;
    while (folded(rest).startsWith(prefix)) {
      rest = rest.slice(piece.length).trim();
    }
    if (folded(rest) === folded(piece)) return "";
    return rest;
  }
  const suffix = ` ${folded(piece)}`;
  if (folded(rest).endsWith(suffix)) {
    const cut = rest.slice(0, rest.length - piece.length).trim();
    if (cut) return cut;
  }
  return rest;
}

/** Prénom + nom, une seule fois, sans postnom. */
export function formatMessagingPersonName(user: {
  prenom?: string | null;
  name?: string | null;
  postnom?: string | null;
} | null | undefined) {
  if (!user) return "Utilisateur";
  const prenom = user.prenom?.trim() ?? "";
  let nom = stripToken(user.name?.trim() ?? "", prenom, "start");
  nom = stripToken(nom, user.postnom?.trim() ?? "", "end");
  nom = stripToken(nom, prenom, "start");
  if (prenom && nom) return `${prenom} ${nom}`;
  return prenom || nom || "Utilisateur";
}

/** Numéro du compte, tel qu'enregistré, pour la fiche contact. */
export function messagingAccountPhone(telephone?: string | null) {
  const value = telephone?.trim() ?? "";
  return value.length > 0 ? value : null;
}

/**
 * Borne `updatedAt` pour un rattrapage. Invalide ou vide : pas de filtre,
 * la liste complète n'est lue qu'une fois à la connexion.
 */
export function parseConversationSince(since?: string | null): Date | null {
  const raw = since?.trim() ?? "";
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Nom de famille seul, sans prénom ni postnom répétés. */
export function messagingFamilyName(user: {
  prenom?: string | null;
  name?: string | null;
  postnom?: string | null;
} | null | undefined) {
  if (!user) return "";
  const prenom = user.prenom?.trim() ?? "";
  let nom = stripToken(user.name?.trim() ?? "", prenom, "start");
  nom = stripToken(nom, user.postnom?.trim() ?? "", "end");
  return stripToken(nom, prenom, "start");
}

const STRUCTURED_BODY_PREFIX =
  /^(?:__CALL__:|__NOTIFY__:|__SATISFACTION__:)/i;

const ENCRYPTED_BODY = /^k1\.[A-Za-z0-9_-]{120,}$/;

/** Préfixes réservés au bot / système — jamais acceptés depuis un client. */
export function isStructuredMessageBody(raw: string) {
  return STRUCTURED_BODY_PREFIX.test(raw.trimStart());
}

/** Ciphertext posé par le téléphone. Le serveur ne le déchiffre pas. */
export function isEncryptedMessageBody(raw: string) {
  const value = raw.trim();
  return (
    value.length <= MESSAGING_MAX_CIPHER_LENGTH && ENCRYPTED_BODY.test(value)
  );
}

/**
 * Nettoie un corps de message.
 * - Clients : strip HTML, contrôles, et refuse les préfixes `__NOTIFY__` / `__CALL__` / etc.
 * - Bot / trusted (`allowStructured`) : conserve les cartes système.
 * - Enveloppe chiffrée `k1.` : opaque, jamais altérée ni tronquée à 4000.
 */
export function sanitizeMessageBody(
  raw: string,
  options?: { allowStructured?: boolean },
) {
  const trimmed = raw.trim();
  if (isEncryptedMessageBody(trimmed)) return trimmed;
  if (options?.allowStructured && isStructuredMessageBody(trimmed)) {
    return trimmed.slice(0, MESSAGING_MAX_BODY_LENGTH);
  }

  // Injection client : neutraliser le préfixe réservé puis traiter comme texte.
  const withoutReserved = isStructuredMessageBody(trimmed)
    ? trimmed.replace(STRUCTURED_BODY_PREFIX, "").trim()
    : trimmed;

  return withoutReserved
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MESSAGING_MAX_BODY_LENGTH);
}

export function previewMessageBody(body: string, max = 80) {
  if (isEncryptedMessageBody(body)) return ENCRYPTED_MESSAGE_PREVIEW;
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
  if (isEncryptedMessageBody(body)) return ENCRYPTED_MESSAGE_PREVIEW;
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
