"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function useAdminTitle(): string {
  const pathname = usePathname();
  const params = useParams();
  const { data: orgs } = authClient.useListOrganizations();

  if (pathname === "/admin") return "Accueil";

  if (pathname.startsWith("/admin/organizations/new"))
    return "Nouvelle organisation";

  const orgId = params.organizationId as string | undefined;
  if (orgId && pathname.startsWith(`/admin/organizations/${orgId}`)) {
    if (pathname.includes(`/${orgId}/members/new`)) return "Nouveau membre";
    if (pathname.includes(`/${orgId}/members/`) && pathname.endsWith("/edit"))
      return "Modifier le membre";
    if (pathname.includes(`/${orgId}/members`)) return "Membres";
    if (pathname.includes(`/${orgId}/roles`)) return "Roles & permissions";
    if (pathname.includes(`/${orgId}/support`)) return "Support etablissement";

    const list = Array.isArray(orgs) ? orgs : [];
    const org = list.find((o) => o.id === orgId);
    return org?.name ?? "Organisation";
  }

  if (pathname.startsWith("/admin/organizations")) return "Organisations";

  if (pathname.startsWith("/admin/account")) return "Compte";
  if (pathname.startsWith("/admin/settings")) return "Parametres";
  if (pathname.startsWith("/admin/help")) return "Centre d'aide";

  return "Administration";
}

export function AdminTopBar() {
  const title = useAdminTitle();
  const router = useRouter();

  async function handleSignOut() {
    try {
      await authClient.signOut();
      router.push("/auth/sign-in");
      router.refresh();
    } catch {
      toast.error("Deconnexion impossible.");
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b bg-white/95 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0px,env(safe-area-inset-top))] shadow-sm backdrop-blur",
        "supports-backdrop-filter:bg-white/85 md:px-6",
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-950/60">
          Administration
        </p>
        <h1 className="truncate text-lg font-bold leading-tight text-slate-950 sm:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-full text-slate-600 hover:bg-slate-100 hover:text-blue-950"
          aria-label="Notifications"
          title="Notifications (bientot)"
        >
          <Bell className="size-5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleSignOut()}
          className="h-10 rounded-full border-blue-950/20 px-3 text-blue-950 hover:bg-blue-950 hover:text-white sm:px-4"
        >
          <LogOut className="size-4 sm:mr-2" />
          <span className="hidden sm:inline">Deconnexion</span>
        </Button>
      </div>
    </header>
  );
}
