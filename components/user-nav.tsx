"use client";

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
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { useAppLoading } from "@/hooks/use-app-loading";
import { getPrimaryRoleLabel } from "@/lib/sidebar-menu";
import { normalizeImageSrc } from "@/lib/utils";
import {
  getUserInitials,
  resolveUserDisplayName,
  type SessionUserDisplay,
} from "@/lib/user-display";
import { LogOut, Settings, UserRound } from "lucide-react";

export function UserNav() {
  const router = useRouter();
  const { resetLoading } = useAppLoading();
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
          className="relative flex h-auto items-center gap-2 rounded-full px-1.5 py-1"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={normalizeImageSrc(user?.image)}
              alt={displayName}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {session ? (
            <span className="hidden min-w-0 flex-col items-start text-left sm:flex">
              <span className="max-w-[10rem] truncate text-sm font-medium leading-tight text-primary">
                {displayName}
              </span>
              <span className="max-w-[10rem] truncate text-xs leading-tight text-muted-foreground capitalize">
                {roleLabel}
              </span>
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        {session ? (
          <DropdownMenuLabel className="">
            <div className="flex flex-col space-y-1">
              <p className="text-sm text-primary">{displayName}</p>
              <p className="leading-none text-muted-foreground capitalize">
                {roleLabel}
              </p>
            </div>
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuLabel className="font-normal">
            Loading...
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
            <UserRound className="mr-2 size-4" />
            Profil
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              router.push("/admin/settings");
            }}
          >
            <Settings className="mr-2 size-4" />
            Paramètres
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void (async () => {
              try {
                await authClient.signOut();
                window.location.assign("/auth/sign-in");
              } finally {
                resetLoading();
              }
            })();
          }}
        >
          <LogOut className="mr-2 size-4" />
          Se déconnecter
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
