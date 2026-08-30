"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MessagingWorkspace } from "@/components/messaging/messaging-workspace";
import { authClient } from "@/lib/auth-client";
import {
  canCreateGroup,
  canUseMessaging,
} from "@/lib/messaging/messaging-policy";
import { getMessagingUnreadCountAction } from "@/lib/actions/messaging.actions";
import {
  MESSAGING_DRAWER_OPEN_EVENT,
  MESSAGING_REFRESH_EVENT,
  NOTIFICATIONS_REFRESH_EVENT,
  type MessagingDrawerOpenDetail,
} from "@/lib/notification-events";
import { shouldPreventDismissOutside } from "@/lib/radix-portal-dismiss";
import { cn } from "@/lib/utils";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span
        aria-label={`${count} conversation${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`}
        className={cn(
          "relative inline-flex h-4 min-w-4 items-center justify-center",
          "rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white",
          "ring-2 ring-background",
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}

export function MessagingDrawer() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const { data: session } = authClient.useSession();
  const organizationId = params.organizationId;
  const branchId = params.branchId ?? null;
  const currentUserId = session?.user?.id ?? "";
  const memberRole =
    session?.organization?.role ?? session?.member?.role ?? null;

  const allowed = canUseMessaging({
    appRole: session?.user?.role,
    memberRole,
  });

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contextType, setContextType] = useState<string | null>(null);
  const [contextId, setContextId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const loadCount = useCallback(async () => {
    if (!organizationId || !allowed) {
      setUnread(0);
      return;
    }
    try {
      const [data] = await getMessagingUnreadCountAction({ organizationId });
      if (typeof data?.count === "number") setUnread(data.count);
    } catch {
      // Conserver le dernier compteur connu.
    }
  }, [organizationId, allowed]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (!organizationId || !allowed) return;
    const interval = window.setInterval(() => {
      void loadCount();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [organizationId, allowed, loadCount]);

  useEffect(() => {
    function onRefresh() {
      void loadCount();
    }
    window.addEventListener(MESSAGING_REFRESH_EVENT, onRefresh);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    function onVisible() {
      if (document.visibilityState === "visible") onRefresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(MESSAGING_REFRESH_EVENT, onRefresh);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadCount]);

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<MessagingDrawerOpenDetail>).detail;
      setConversationId(detail?.conversationId ?? null);
      setContextType(detail?.contextType ?? null);
      setContextId(detail?.contextId ?? null);
      setOpen(true);
    }
    window.addEventListener(MESSAGING_DRAWER_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(MESSAGING_DRAWER_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (shouldPreventDismissOutside(event.target)) return;
      if (
        target instanceof Element &&
        (target.closest("[role='dialog']") ||
          target.closest("[data-radix-dialog-overlay]") ||
          document.querySelector("[data-radix-dialog-overlay]"))
      ) {
        return;
      }
      setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (!organizationId || !allowed || !currentUserId) return null;

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="secondary"
        size="icon"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (!next) {
              setConversationId(null);
              setContextType(null);
              setContextId(null);
            }
            return next;
          });
        }}
        aria-expanded={open}
        aria-controls="messaging-drawer-panel"
        aria-label={
          unread > 0
            ? `Messagerie, ${unread} non lu${unread > 1 ? "s" : ""}`
            : "Messagerie"
        }
        className={cn(
          "fixed z-40 size-11 rounded-full border border-border bg-background text-primary shadow-lg",
          "hover:bg-accent hover:text-primary",
          "right-3 top-[4.35rem] md:right-8 md:top-[3.65rem]",
          open && "hidden",
        )}
        aria-hidden={open}
      >
        <MessageSquare className="size-5" />
        <UnreadBadge count={unread} />
      </Button>

      {open ? (
        <div
          id="messaging-drawer-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Messagerie"
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden border bg-background shadow-2xl",
            "right-2 left-2 top-[4.35rem] bottom-[5.1rem] rounded-xl",
            "md:left-auto md:right-8 md:top-[3.65rem] md:bottom-4 md:w-[26rem]",
          )}
        >
          <MessagingWorkspace
            organizationId={organizationId}
            currentUserId={currentUserId}
            canPurge={false}
            canCreateGroup={canCreateGroup({
              appRole: session?.user?.role,
              memberRole,
            })}
            initialConversationId={conversationId}
            fromBranchId={branchId}
            contextType={contextType}
            contextId={contextId}
            variant="drawer"
            onClose={() => setOpen(false)}
            onUnreadChange={setUnread}
          />
        </div>
      ) : null}
    </>
  );
}
