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
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getPrimaryRoleLabel } from "@/lib/sidebar-menu";

export function UserNav() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user as any;
  const prenom =
    user?.prenom || user?.postnom?.split(" ")?.[0] || "DefaultFirst";
  const nom = user?.name?.split(" ")?.slice(1).join(" ") || "DefaultLast";
  const roleLabel = getPrimaryRoleLabel(session);

  const getInitials = (prenom: string, nom: string) => {
    return `${prenom[0]}${nom[0]}`.toUpperCase();
  };

  const initials = getInitials(prenom, nom);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full ">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatars/01.png" alt="@kalasa" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        {session ? (
          <DropdownMenuLabel className="">
            <div className="flex flex-col space-y-1">
              <p className="text-sm text-primary">
                {`${prenom} ${nom}`.toUpperCase()}
              </p>
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
          <DropdownMenuItem>
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              router.push("/admin/settings");
            }}
          >
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void authClient.signOut();
            router.push("/auth/sign-in");
          }}
        >
          Se déconnecter
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
