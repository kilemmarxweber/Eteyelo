"use client";

import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { authClient } from "@/lib/auth-client";
import { getPrimaryRoleLabel } from "@/lib/sidebar-menu";
import { cn, normalizeImageSrc } from "@/lib/utils";
import {
  getUserInitials,
  resolveUserDisplayName,
  type SessionUserDisplay,
} from "@/lib/user-display";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";

export function UserNav() {
  const tNav = useTranslations("nav");
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user as SessionUserDisplay | undefined;
  const displayName = resolveUserDisplayName(user);
  const roleLabel = getPrimaryRoleLabel(session);
  const initials = getUserInitials(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "relative h-auto gap-2 rounded-full border border-transparent px-1.5 py-1",
            "hover:border-border hover:bg-muted/60",
            "data-[state=open]:border-border data-[state=open]:bg-muted/60",
          )}
        >
          <Avatar className="size-8 ring-2 ring-background">
            <AvatarImage
              src={normalizeImageSrc(user?.image)}
              alt={displayName}
            />
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {session ? (
            <span className="hidden min-w-0 flex-col items-start text-left sm:flex">
              <span className="max-w-[9.5rem] truncate text-sm font-semibold leading-tight text-foreground">
                {displayName}
              </span>
              <span className="max-w-[9.5rem] truncate text-[11px] leading-tight text-muted-foreground capitalize">
                {roleLabel}
              </span>
            </span>
          ) : null}
          <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 p-0" align="end" forceMount>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-3">
            <Avatar className="size-10">
              <AvatarImage
                src={normalizeImageSrc(user?.image)}
                alt={displayName}
              />
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-0.5">
              {session ? (
                <>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground capitalize">
                    {roleLabel}
                  </p>
                  {user?.email ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {user.email}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{tNav("loading")}</p>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuGroup className="p-1">
          <DropdownMenuItem
            className="gap-2 rounded-md"
            onClick={() => router.push("/admin/settings")}
          >
            <UserRound className="size-4 text-muted-foreground" />
            {tNav("profile")}
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 rounded-md"
            onClick={() => router.push("/admin/settings")}
          >
            <Settings className="size-4 text-muted-foreground" />
            {tNav("settings")}
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-0" />

        <div className="p-1">
          <DropdownMenuItem
            className="gap-2 rounded-md text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => {
              void (async () => {
                try {
                  await authClient.signOut();
                  window.location.assign("/auth/sign-in");
                } catch {
                  window.location.assign("/auth/sign-in");
                }
              })();
            }}
          >
            <LogOut className="size-4" />
            {tNav("signOut")}
            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
