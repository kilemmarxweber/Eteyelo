"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BellOff,
  BellRing,
  Check,
  Loader2,
  MessageSquare,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  Users,
  WifiOff,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { BackLink } from "@/components/ui/back-link";
import { cn } from "@/lib/utils";
import {
  refreshMessagingBell,
  refreshNotificationBell,
} from "@/lib/notification-events";
import { useMessagingRefreshListener } from "@/lib/messaging/use-messaging-refresh-listener";
import {
  archiveConversationAction,
  archiveMessageAction,
  createConversationAction,
  createGroupAction,
  getConversationMessagesAction,
  listMyConversationsAction,
  markConversationReadAction,
  purgeOrganizationMessagingAction,
  searchMessagingRecipientsAction,
  sendMessageAction,
  toggleConversationMuteAction,
} from "@/lib/actions/messaging.actions";
import {
  MESSAGING_MAX_BODY_LENGTH,
  MESSAGING_MAX_SUBJECT_LENGTH,
  MESSAGING_PURGE_CONFIRMATION,
  type ConversationListItem,
  type MessageView,
  type MessagingFilter,
  type MessagingRecipient,
} from "@/lib/messaging/messaging-types";

const FILTERS: Array<{ id: MessagingFilter; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "unread", label: "Non lues" },
  { id: "direct", label: "Directes" },
  { id: "groups", label: "Groupes" },
  { id: "archived", label: "Archivées" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(sameDay ? {} : { day: "numeric", month: "short" }),
  }).format(date);
}

function actionError(err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: string }).message);
  }
  return "Une erreur est survenue.";
}

export function MessagingWorkspace({
  organizationId,
  currentUserId,
  canPurge,
  canCreateGroup: allowGroup = true,
  initialConversationId,
  fromBranchId,
  contextType,
  contextId,
  variant = "page",
  onClose,
  onUnreadChange,
}: {
  organizationId: string;
  currentUserId: string;
  canPurge: boolean;
  canCreateGroup: boolean;
  initialConversationId: string | null;
  fromBranchId: string | null;
  contextType?: string | null;
  contextId?: string | null;
  variant?: "page" | "drawer";
  onClose?: () => void;
  onUnreadChange?: (count: number) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<MessagingFilter>("all");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [sending, setSending] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [contextualOpen, setContextualOpen] = useState(
    Boolean(contextType && contextId),
  );
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<string | null>(initialConversationId);
  const lastThreadMessageIdRef = useRef<string | null>(null);

  const selected = conversations.find((row) => row.id === selectedId) ?? null;
  const compact = variant === "drawer";
  const mobileThread = Boolean(selectedId);

  const backHref = fromBranchId
    ? `/admin/organizations/${organizationId}/branches/${fromBranchId}`
    : `/admin/organizations/${organizationId}`;

  const loadList = useCallback(async () => {
    const [data, err] = await listMyConversationsAction({
      organizationId,
      filter,
      query,
    });
    if (err) {
      toast.error(actionError(err));
      return;
    }
    setConversations(data.items);
    setUnreadConversations(data.unreadConversations);
    onUnreadChange?.(data.unreadConversations);
  }, [organizationId, filter, query, onUnreadChange]);

  const loadThread = useCallback(
    async (conversationId: string, silent = false) => {
      if (!silent) setThreadLoading(true);
      const [data, err] = await getConversationMessagesAction({
        organizationId,
        conversationId,
      });
      if (!silent) setThreadLoading(false);
      if (err) {
        toast.error(actionError(err));
        return;
      }
      setMessages(data.items);
      const lastId = data.items.at(-1)?.id ?? null;
      const hasNew = lastId !== lastThreadMessageIdRef.current;
      lastThreadMessageIdRef.current = lastId;
      if (!silent || hasNew) {
        await markConversationReadAction({ organizationId, conversationId });
        refreshNotificationBell();
      }
    },
    [organizationId],
  );

  useEffect(() => {
    if (initialConversationId) setSelectedId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (contextType && contextId) setContextualOpen(true);
  }, [contextType, contextId]);

  useEffect(() => {
    setListLoading(true);
    void loadList().finally(() => setListLoading(false));
  }, [loadList]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    lastThreadMessageIdRef.current = null;
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  useEffect(() => {
    if (!contextType || !contextId || conversations.length === 0) return;
    const existing = conversations.find(
      (row) => row.contextType === contextType && row.contextId === contextId,
    );
    if (existing) {
      setSelectedId(existing.id);
      setContextualOpen(false);
    }
  }, [conversations, contextType, contextId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useMessagingRefreshListener(() => {
    void loadList();
    const openId = selectedIdRef.current;
    if (openId) void loadThread(openId, true);
  });

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function handleSend() {
    if (!selectedId || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    const clientMessageId = crypto.randomUUID();
    const [data, err] = await sendMessageAction({
      organizationId,
      conversationId: selectedId,
      body,
      replyToId: replyTo?.id,
      clientMessageId,
    });
    setSending(false);
    if (err) {
      toast.error(actionError(err));
      return;
    }
    if (data) {
      setDraft("");
      setReplyTo(null);
      await loadThread(selectedId, true);
      void loadList();
      refreshNotificationBell();
      refreshMessagingBell();
    }
  }

  async function handleArchiveConversation(archived: boolean) {
    if (!selectedId) return;
    const [, err] = await archiveConversationAction({
      organizationId,
      conversationId: selectedId,
      archived,
    });
    if (err) {
      toast.error(actionError(err));
      return;
    }
    if (archived) setSelectedId(null);
    await loadList();
  }

  async function handleMute(muted: boolean) {
    if (!selectedId) return;
    const [, err] = await toggleConversationMuteAction({
      organizationId,
      conversationId: selectedId,
      muted,
    });
    if (err) {
      toast.error(actionError(err));
      return;
    }
    await loadList();
  }

  async function handleArchiveMessage(messageId: string, archived: boolean) {
    const [, err] = await archiveMessageAction({
      organizationId,
      messageId,
      archived,
    });
    if (err) {
      toast.error(actionError(err));
      return;
    }
    if (selectedId) await loadThread(selectedId);
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        compact ? "h-full min-h-0" : "min-h-[100dvh]",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 border-b",
          compact ? "px-3 py-2" : "px-4 py-3",
        )}
      >
        {compact ? (
          onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onClose}
              aria-label="Fermer la messagerie"
            >
              <X className="size-4" />
            </Button>
          ) : null
        ) : (
          <BackLink href={backHref} label="Retour" />
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              "flex items-center gap-2 font-semibold",
              compact ? "text-base" : "text-lg",
            )}
          >
            <MessageSquare className="size-5 text-primary" />
            Messagerie
            {unreadConversations > 0 ? (
              <Badge variant="secondary">{unreadConversations}</Badge>
            ) : null}
          </h1>
          {compact ? null : (
            <p className="text-xs text-muted-foreground">
              Conversations internes de l&apos;organisation
            </p>
          )}
        </div>
        {compact ? (
          <Button
            type="button"
            size="sm"
            className="h-8 px-2"
            onClick={() => setComposerOpen(true)}
          >
            <Plus className="size-4" />
            Écrire
          </Button>
        ) : null}
        {canPurge && !compact ? (
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => setPurgeOpen(true)}
          >
            <Trash2 className="size-4" />
            Nettoyer
          </Button>
        ) : null}
      </header>

      {offline ? (
        <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          <WifiOff className="size-4" />
          Hors connexion — les messages seront envoyés une fois reconnecté.
        </div>
      ) : null}

      <div
        className={cn(
          "grid min-h-0 flex-1",
          compact ? "grid-cols-1" : "md:grid-cols-[20rem_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r",
            compact
              ? mobileThread
                ? "hidden"
                : "flex"
              : mobileThread
                ? "hidden md:flex"
                : "flex",
          )}
        >
          <div className="space-y-2 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8"
              />
            </div>
            {allowGroup ? (
              <div className="grid grid-cols-2 gap-2">
                <Button className="w-full" onClick={() => setComposerOpen(true)}>
                  <Plus className="size-4" />
                  Message
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setGroupOpen(true)}
                >
                  <Users className="size-4" />
                  Groupe
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={() => setComposerOpen(true)}>
                <Plus className="size-4" />
                Nouveau message
              </Button>
            )}
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={filter === item.id ? "default" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setFilter(item.id);
                    setSelectedId(null);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {listLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune conversation.
              </p>
            ) : (
              conversations.map((row) => {
                const active = row.id === selectedId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b px-3 py-3 text-left transition hover:bg-accent/60",
                      active && "bg-accent",
                    )}
                  >
                    <Avatar className="size-10">
                      <AvatarImage src={row.participants.find((p) => p.userId !== currentUserId)?.image ?? undefined} />
                      <AvatarFallback>{initials(row.title)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {row.title}
                        </span>
                        {row.unreadCount > 0 ? (
                          <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {row.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {row.lastMessage?.body ?? "Aucun message"}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        {row.type === "GROUP" ? <Users className="size-3" /> : null}
                        {row.lastMessage ? formatTime(row.lastMessage.createdAt) : null}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </aside>

        <section
          className={cn(
            "flex min-h-0 flex-col",
            compact
              ? mobileThread
                ? "flex"
                : "hidden"
              : mobileThread
                ? "flex"
                : "hidden md:flex",
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <MessageSquare className="size-10 opacity-50" />
              <p>Sélectionnez une conversation ou créez-en une.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={compact ? undefined : "md:hidden"}
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{selected.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.participants
                      .filter((p) => p.userId !== currentUserId)
                      .map((p) =>
                        [p.name, p.branches[0]?.name].filter(Boolean).join(" · "),
                      )
                      .join(" · ")}
                  </p>
                </div>
                {selected.contextHref ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(selected.contextHref!)}
                  >
                    Voir le dossier
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  title={selected.muted ? "Réactiver les notifications" : "Couper les notifications"}
                  onClick={() => void handleMute(!selected.muted)}
                >
                  {selected.muted ? (
                    <BellRing className="size-4" />
                  ) : (
                    <BellOff className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title={selected.archived ? "Désarchiver" : "Archiver"}
                  onClick={() => void handleArchiveConversation(!selected.archived)}
                >
                  {selected.archived ? (
                    <ArchiveRestore className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )}
                </Button>
              </div>

              <ScrollArea className="min-h-0 flex-1 px-4 py-3">
                {threadLoading ? (
                  <div className="flex justify-center py-8 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages
                      .filter((row) => filter === "archived" || !row.archivedForMe)
                      .map((row) => {
                        const mine = row.senderId === currentUserId;
                        return (
                          <div
                            key={row.id}
                            className={cn(
                              "flex gap-2",
                              mine ? "justify-end" : "justify-start",
                            )}
                          >
                            {!mine ? (
                              <Avatar className="mt-1 size-8">
                                <AvatarImage src={row.senderImage ?? undefined} />
                                <AvatarFallback>{initials(row.senderName)}</AvatarFallback>
                              </Avatar>
                            ) : null}
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                                mine
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted",
                                row.archivedForMe && "opacity-60",
                              )}
                            >
                              {!mine ? (
                                <p className="mb-0.5 text-[11px] font-medium opacity-80">
                                  {row.senderName}
                                  {row.senderBranches[0]
                                    ? ` · ${row.senderBranches[0].name}`
                                    : ""}
                                </p>
                              ) : null}
                              {row.replyTo ? (
                                <p className="mb-1 line-clamp-2 rounded bg-black/10 px-2 py-1 text-[11px] opacity-80">
                                  {row.replyTo.senderName} : {row.replyTo.body}
                                </p>
                              ) : null}
                              <p className="whitespace-pre-wrap break-words">
                                {row.body}
                              </p>
                              <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-70">
                                <span>{formatTime(row.createdAt)}</span>
                                {mine ? <Check className="size-3" /> : null}
                              </div>
                              <div className="mt-1 flex gap-1">
                                <button
                                  type="button"
                                  className="text-[10px] underline-offset-2 hover:underline"
                                  onClick={() => setReplyTo(row)}
                                >
                                  Répondre
                                </button>
                                <button
                                  type="button"
                                  className="text-[10px] underline-offset-2 hover:underline"
                                  onClick={() =>
                                    void handleArchiveMessage(
                                      row.id,
                                      !row.archivedForMe,
                                    )
                                  }
                                >
                                  {row.archivedForMe ? "Désarchiver" : "Archiver"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    <div ref={threadEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="border-t p-3">
                {replyTo ? (
                  <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs">
                    <span className="flex items-center gap-1 truncate">
                      <Reply className="size-3" />
                      {replyTo.senderName} : {replyTo.body}
                    </span>
                    <button type="button" onClick={() => setReplyTo(null)}>
                      ×
                    </button>
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={MESSAGING_MAX_BODY_LENGTH}
                    placeholder="Écrire un message…"
                    className="min-h-[44px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim() || offline}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  {draft.length}/{MESSAGING_MAX_BODY_LENGTH}
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <NewConversationDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        organizationId={organizationId}
        onCreated={(id) => {
          setComposerOpen(false);
          setSelectedId(id);
          if (filter !== "all") {
            setFilter("all");
          } else {
            void loadList();
          }
          refreshNotificationBell();
          refreshMessagingBell();
        }}
      />

      {allowGroup ? (
        <NewGroupDialog
          open={groupOpen}
          onOpenChange={setGroupOpen}
          organizationId={organizationId}
          onCreated={(id) => {
            setGroupOpen(false);
            setSelectedId(id);
            if (filter !== "all") {
              setFilter("all");
            } else {
              void loadList();
            }
            refreshNotificationBell();
            refreshMessagingBell();
          }}
        />
      ) : null}

      {contextType && contextId ? (
        <ContextualReplyDialog
          open={contextualOpen}
          onOpenChange={setContextualOpen}
          organizationId={organizationId}
          contextType={contextType}
          contextId={contextId}
          onCreated={(id) => {
            setContextualOpen(false);
            setSelectedId(id);
            if (filter !== "all") {
              setFilter("all");
            } else {
              void loadList();
            }
            refreshNotificationBell();
            refreshMessagingBell();
          }}
        />
      ) : null}

      {canPurge ? (
        <PurgeDialog
          open={purgeOpen}
          onOpenChange={setPurgeOpen}
          organizationId={organizationId}
          conversationId={selectedId}
          onDone={() => {
            setSelectedId(null);
            void loadList();
          }}
        />
      ) : null}
    </div>
  );
}

function NewConversationDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onCreated: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessagingRecipient[]>([]);
  const [selected, setSelected] = useState<MessagingRecipient[]>([]);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setSearching(true);
      void searchMessagingRecipientsAction({ organizationId, query }).then(
        ([data, err]) => {
          setSearching(false);
          if (err) {
            toast.error(actionError(err));
            setResults([]);
            return;
          }
          setResults(data?.items ?? []);
        },
      );
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, organizationId, query]);

  const remaining = useMemo(
    () =>
      results.filter((row) => !selected.some((s) => s.userId === row.userId)),
    [results, selected],
  );

  async function submit() {
    if (selected.length === 0 || !body.trim()) return;
    setSending(true);
    const [data, err] = await createConversationAction({
      organizationId,
      recipientIds: selected.map((row) => row.userId),
      body,
      subject: selected.length > 1 ? subject : null,
      clientMessageId: crypto.randomUUID(),
    });
    setSending(false);
    if (err) {
      toast.error(actionError(err));
      return;
    }
    if (data) {
      setBody("");
      setSubject("");
      setSelected([]);
      onCreated(data.conversationId);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="flex min-h-0 min-w-0 w-[min(calc(100vw-1.5rem),28rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-4 p-4 sm:p-6"
      >
        <DialogHeader className="min-w-0 space-y-2 text-left">
          <DialogTitle className="pr-8 text-base font-semibold sm:text-lg">
            Nouveau message
          </DialogTitle>
          <DialogDescription className="whitespace-normal break-words text-pretty leading-relaxed">
            Un destinataire crée un fil direct. Plusieurs destinataires créent un
            groupe partagé.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un membre, un rôle ou une branche"
            className="min-w-0"
          />
          {selected.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-1">
              {selected.map((row) => (
                <Badge
                  key={row.userId}
                  variant="secondary"
                  className="max-w-full gap-1"
                >
                  <span className="truncate">{row.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        prev.filter((item) => item.userId !== row.userId),
                      )
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          <ScrollArea className="h-36 min-w-0 rounded-md border sm:h-40">
            {searching ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : remaining.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Aucun membre trouvé.
              </p>
            ) : (
              remaining.map((row) => (
                <button
                  key={row.userId}
                  type="button"
                  className="flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                  onClick={() => setSelected((prev) => [...prev, row])}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={row.image ?? undefined} />
                    <AvatarFallback>{initials(row.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {row.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.roleLabel}
                      {row.branches[0] ? ` · ${row.branches[0].name}` : ""}
                    </span>
                  </span>
                </button>
              ))
            )}
          </ScrollArea>
          {selected.length > 1 ? (
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du groupe (facultatif)"
              className="min-w-0"
            />
          ) : null}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MESSAGING_MAX_BODY_LENGTH}
            placeholder="Message"
            className="min-h-20 min-w-0 resize-none sm:min-h-24"
          />
          <p className="text-right text-[10px] text-muted-foreground">
            {body.length}/{MESSAGING_MAX_BODY_LENGTH}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            className="w-full sm:w-auto"
            onClick={() => void submit()}
            disabled={sending || selected.length === 0 || !body.trim()}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewGroupDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onCreated: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessagingRecipient[]>([]);
  const [selected, setSelected] = useState<MessagingRecipient[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setSearching(true);
      void searchMessagingRecipientsAction({ organizationId, query }).then(
        ([data, err]) => {
          setSearching(false);
          if (err) {
            toast.error(actionError(err));
            setResults([]);
            return;
          }
          setResults(data?.items ?? []);
        },
      );
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, organizationId, query]);

  const remaining = useMemo(
    () =>
      results.filter((row) => !selected.some((s) => s.userId === row.userId)),
    [results, selected],
  );

  async function submit() {
    if (selected.length === 0 || !subject.trim()) return;
    setSending(true);
    const [data, err] = await createGroupAction({
      organizationId,
      recipientIds: selected.map((row) => row.userId),
      subject: subject.trim(),
      body: body.trim() || null,
      clientMessageId: crypto.randomUUID(),
    });
    setSending(false);
    if (err) {
      toast.error(actionError(err));
      return;
    }
    if (data) {
      setBody("");
      setSubject("");
      setSelected([]);
      onCreated(data.conversationId);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="flex min-h-0 min-w-0 w-[min(calc(100vw-1.5rem),28rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-4 p-4 sm:p-6"
      >
        <DialogHeader className="min-w-0 space-y-2 text-left">
          <DialogTitle className="pr-8 text-base font-semibold sm:text-lg">
            Nouveau groupe
          </DialogTitle>
          <DialogDescription className="whitespace-normal break-words text-pretty leading-relaxed">
            Tous les membres sélectionnés partagent le même fil. Un premier
            message est facultatif.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={MESSAGING_MAX_SUBJECT_LENGTH}
            placeholder="Nom du groupe"
            className="min-w-0"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ajouter des membres"
            className="min-w-0"
          />
          {selected.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-1">
              {selected.map((row) => (
                <Badge
                  key={row.userId}
                  variant="secondary"
                  className="max-w-full gap-1"
                >
                  <span className="truncate">{row.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        prev.filter((item) => item.userId !== row.userId),
                      )
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          <ScrollArea className="h-36 min-w-0 rounded-md border sm:h-40">
            {searching ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : remaining.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Aucun membre trouvé.
              </p>
            ) : (
              remaining.map((row) => (
                <button
                  key={row.userId}
                  type="button"
                  className="flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                  onClick={() => setSelected((prev) => [...prev, row])}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={row.image ?? undefined} />
                    <AvatarFallback>{initials(row.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {row.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.roleLabel}
                      {row.branches[0] ? ` · ${row.branches[0].name}` : ""}
                    </span>
                  </span>
                </button>
              ))
            )}
          </ScrollArea>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MESSAGING_MAX_BODY_LENGTH}
            placeholder="Premier message (facultatif)"
            className="min-h-20 min-w-0 resize-none sm:min-h-24"
          />
          <p className="text-right text-[10px] text-muted-foreground">
            {body.length}/{MESSAGING_MAX_BODY_LENGTH}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            className="w-full sm:w-auto"
            onClick={() => void submit()}
            disabled={sending || selected.length === 0 || !subject.trim()}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Users className="size-4" />
            )}
            Créer le groupe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContextualReplyDialog({
  open,
  onOpenChange,
  organizationId,
  contextType,
  contextId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  contextType: string;
  contextId: string;
  onCreated: (conversationId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setSending(true);
    const [data, err] = await createConversationAction({
      organizationId,
      recipientIds: [],
      body,
      clientMessageId: crypto.randomUUID(),
      contextType: contextType as
        | "ABSENCE_CASE"
        | "GRADE_MODIFICATION"
        | "REGISTRATION_REQUEST"
        | "SUPPORT_TICKET",
      contextId,
    });
    setSending(false);
    if (err) {
      toast.error(actionError(err));
      return;
    }
    if (data) onCreated(data.conversationId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="flex min-h-0 min-w-0 w-[min(calc(100vw-1.5rem),28rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-4 p-4 sm:p-6"
      >
        <DialogHeader className="min-w-0 space-y-2 text-left">
          <DialogTitle className="pr-8 text-base font-semibold sm:text-lg">
            Répondre à la demande
          </DialogTitle>
          <DialogDescription className="whitespace-normal break-words text-pretty leading-relaxed">
            Ce fil reste lié au dossier. Le destinataire doit déjà y avoir accès.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MESSAGING_MAX_BODY_LENGTH}
          placeholder="Votre message…"
          className="min-h-24 min-w-0 resize-none"
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            className="w-full sm:w-auto"
            disabled={sending || !body.trim()}
            onClick={() => void submit()}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurgeDialog({
  open,
  onOpenChange,
  organizationId,
  conversationId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  conversationId: string | null;
  onDone: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const [data, err] = await purgeOrganizationMessagingAction({
      organizationId,
      confirmation,
      conversationId,
    });
    setBusy(false);
    if (err) {
      toast.error(actionError(err));
      return;
    }
    toast.success(
      `${data?.conversations ?? 0} conversation(s) nettoyée(s). Cette action est irréversible.`,
    );
    setConfirmation("");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nettoyer la messagerie</DialogTitle>
          <DialogDescription>
            Réservé au propriétaire. Les conversations liées à une justification
            sont conservées. Saisissez {MESSAGING_PURGE_CONFIRMATION} pour
            confirmer.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={MESSAGING_PURGE_CONFIRMATION}
        />
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={busy || confirmation.trim().toUpperCase() !== MESSAGING_PURGE_CONFIRMATION}
            onClick={() => void submit()}
          >
            Confirmer le nettoyage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
