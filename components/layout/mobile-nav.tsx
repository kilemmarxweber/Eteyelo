"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  BookOpen,
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  School,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useAppLoading } from "@/hooks/use-app-loading";
import {
  canAccessResultsArea,
  canAccessTeachingArea,
} from "@/lib/auth/session-roles";
import {
  APP_ROLE,
  ORG_ROLE,
  isAppAdminRole,
  isPlatformOwnerRole,
  isPlatformSupportAppRole,
} from "@/lib/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPrimaryRoleLabel } from "@/lib/sidebar-menu";
import {
  getUserInitials,
  resolveUserDisplayName,
  type SessionUserDisplay,
} from "@/lib/user-display";
import { toast } from "sonner";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ecodimNavItems: NavItem[] = [
  { href: "/ecodim", label: "Accueil", icon: Home },
  { href: "/ecodim/enfants", label: "Enfants", icon: Users },
  { href: "/ecodim/classes", label: "Classes", icon: BookOpen },
  { href: "/ecodim/presence", label: "Presence", icon: ClipboardList },
];

const ECODIM_ORG_ROLES = new Set([
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.PREFET,
  ORG_ROLE.SUPERVISEUR,
]);

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function resolveEcodimBasePath(
  pathname: string,
  organizationId?: string | null,
): string {
  const fromPath = pathname.match(
    /^(\/admin\/organizations\/[^/]+\/ecodim)/,
  )?.[1];
  if (fromPath) return fromPath;
  if (organizationId) return `/admin/organizations/${organizationId}/ecodim`;
  return "/ecodim";
}

function resolveBranchBasePath(pathname: string, session: any) {
  const fromPath = pathname.match(
    /^(\/admin\/organizations\/[^/]+\/branches\/[^/]+)/,
  )?.[1];
  if (fromPath) return fromPath;

  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;

  if (organizationId && branchId) {
    return `/admin/organizations/${organizationId}/branches/${branchId}`;
  }

  return null;
}

function isEcodimContext(pathname: string, session: any) {
  if (pathname.includes("/ecodim")) return true;

  const orgRoles = splitRoles(session?.organization?.role);
  return orgRoles.some((role) =>
    (ECODIM_ORG_ROLES as Set<string>).has(role),
  );
}

function MobileNavBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 items-stretch justify-around">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
              "touch-manipulation active:bg-muted/50",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-5", isActive && "stroke-[2.5px]")} />
            <span
              className={cn(
                "text-[10px] font-medium leading-none",
                isActive && "font-semibold",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
      <MobileNavMoreMenu />
    </div>
  );
}

function MobileNavMoreMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { resetLoading } = useAppLoading();
  const { data: session } = authClient.useSession();
  const user = session?.user as (SessionUserDisplay & { image?: string | null }) | undefined;
  const displayName = resolveUserDisplayName(user);
  const roleLabel = getPrimaryRoleLabel(session);
  const initials = getUserInitials(displayName);

  const moreActive =
    pathname.startsWith("/admin/account") ||
    pathname.startsWith("/admin/settings");

  async function handleSignOut() {
    try {
      await authClient.signOut();
      window.location.assign("/auth/sign-in");
    } catch {
      toast.error("Deconnexion impossible.");
    } finally {
      resetLoading();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu compte"
        className={cn(
          "flex min-h-[60px] flex-1 items-center justify-center px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          "border-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Avatar
          className={cn(
            "size-9 ring-2 ring-transparent",
            moreActive && "ring-primary/40",
          )}
        >
          {user?.image ? (
            <AvatarImage src={user.image} alt={displayName} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="top"
        sideOffset={8}
        className="min-w-48"
      >
        {session ? (
          <>
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-primary">{displayName}</p>
                <p className="text-xs font-normal leading-none text-muted-foreground capitalize">
                  {roleLabel}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          className="min-h-10 cursor-pointer"
          onClick={() => router.push("/admin/account")}
        >
          <User className="size-4" />
          Compte
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-10 cursor-pointer"
          onClick={() => router.push("/admin/settings")}
        >
          <Settings className="size-4" />
          Parametres
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn(
            "min-h-10 cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground",
          )}
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-4" />
          Deconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlatformOwnerMobileNav() {
  const pathname = usePathname();
  const homeActive = pathname === "/admin";
  const orgActive = pathname.startsWith("/admin/organizations");

  return (
    <div className="flex flex-1 items-stretch justify-around">
      <Link
        href="/admin"
        className={cn(
          "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          homeActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutDashboard
          className={cn("size-5", homeActive && "stroke-[2.5px]")}
        />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            homeActive && "font-semibold",
          )}
        >
          Accueil
        </span>
      </Link>

      <Link
        href="/admin/organizations"
        className={cn(
          "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          orgActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Building2 className={cn("size-5", orgActive && "stroke-[2.5px]")} />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            orgActive && "font-semibold",
          )}
        >
          Organisations
        </span>
      </Link>

      <MobileNavMoreMenu />
    </div>
  );
}

function OrgAdminMobileNav({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const orgHome = `/admin/organizations/${organizationId}`;
  const branchesHref = `${orgHome}/branches`;
  const homeActive =
    pathname === orgHome || pathname === `${orgHome}/`;
  const branchesActive = pathname.startsWith(branchesHref);

  return (
    <div className="flex flex-1 items-stretch justify-around">
      <Link
        href={orgHome}
        className={cn(
          "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          homeActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Building2 className={cn("size-5", homeActive && "stroke-[2.5px]")} />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            homeActive && "font-semibold",
          )}
        >
          Organisation
        </span>
      </Link>

      <Link
        href={branchesHref}
        className={cn(
          "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          branchesActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <School className={cn("size-5", branchesActive && "stroke-[2.5px]")} />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            branchesActive && "font-semibold",
          )}
        >
          Branches
        </span>
      </Link>

      <MobileNavMoreMenu />
    </div>
  );
}

function PlatformSupportMobileNav() {
  const pathname = usePathname();
  const supportActive = pathname.startsWith("/admin/platform-support");

  return (
    <div className="flex flex-1 items-stretch justify-around">
      <Link
        href="/admin/platform-support"
        className={cn(
          "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          supportActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LifeBuoy className={cn("size-5", supportActive && "stroke-[2.5px]")} />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            supportActive && "font-semibold",
          )}
        >
          Support
        </span>
      </Link>

      <MobileNavMoreMenu />
    </div>
  );
}

function BranchMobileNav({ session }: { session: any }) {
  const pathname = usePathname();
  const branchBase = resolveBranchBasePath(pathname, session);

  const items = useMemo(() => {
    if (!branchBase) return [];

    const nav: NavItem[] = [
      { href: branchBase, label: "Accueil", icon: LayoutDashboard },
    ];

    if (canAccessResultsArea(session)) {
      nav.push({
        href: `${branchBase}/results`,
        label: "Resultats",
        icon: ClipboardList,
      });
    } else if (canAccessTeachingArea(session)) {
      nav.push({
        href: `${branchBase}/schedule`,
        label: "Horaire",
        icon: BookOpen,
      });
    }

    return nav;
  }, [branchBase, session]);

  if (!items.length) {
    return (
      <div className="flex flex-1 items-stretch justify-end">
        <MobileNavMoreMenu />
      </div>
    );
  }

  return <MobileNavBar items={items} />;
}

function EcodimMobileNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const navItems = useMemo(() => {
    const base = resolveEcodimBasePath(pathname, session?.organization?.id);
    return ecodimNavItems.map((item) => ({
      ...item,
      href: item.href.replace("/ecodim", base),
    }));
  }, [pathname, session?.organization?.id]);

  return <MobileNavBar items={navItems} />;
}

export function MobileNav() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const appRole = session?.user?.role;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId ?? null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden safe-area-bottom">
      {isPending ? (
        <div className="min-h-[60px] flex-1" aria-hidden />
      ) : isPlatformOwnerRole(appRole) ? (
        <PlatformOwnerMobileNav />
      ) : isPlatformSupportAppRole(appRole) ? (
        <PlatformSupportMobileNav />
      ) : isAppAdminRole(appRole) && organizationId ? (
        <OrgAdminMobileNav organizationId={organizationId} />
      ) : isEcodimContext(pathname, session) ? (
        <EcodimMobileNav />
      ) : (
        <BranchMobileNav session={session} />
      )}
    </nav>
  );
}
