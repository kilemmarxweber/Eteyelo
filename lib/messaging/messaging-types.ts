export const MESSAGING_MAX_BODY_LENGTH = 4000;
export const MESSAGING_MAX_SUBJECT_LENGTH = 120;
export const MESSAGING_MAX_RECIPIENTS = 50;
export const MESSAGING_RATE_LIMIT_PER_MINUTE = 20;
export const MESSAGING_SEARCH_PAGE_SIZE = 20;
export const MESSAGING_CONVERSATIONS_PAGE_SIZE = 30;
export const MESSAGING_MESSAGES_PAGE_SIZE = 40;
export const MESSAGING_PURGE_CONFIRMATION = "NETTOYER";

export type ConversationTypeValue = "DIRECT" | "GROUP" | "CONTEXTUAL";
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
  participants: Array<{
    userId: string;
    name: string;
    image: string | null;
    roleLabel: string;
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
  } | null;
  createdAt: string;
  archivedForMe: boolean;
};

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
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function previewMessageBody(body: string, max = 80) {
  const text = body.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
