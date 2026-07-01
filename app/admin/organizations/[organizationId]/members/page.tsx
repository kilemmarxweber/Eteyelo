"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date | string;
  user: { id: string; email: string; name: string; image?: string | null };
};

export default function OrganizationMembersPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authClient.organization.listMembers({
        query: { organizationId, limit: 100 },
      });

      if (res.error) {
        toast.error(res.error.message ?? "Erreur chargement.");
        setMembers([]);
        return;
      }

      const raw = res.data?.members;
      setMembers(Array.isArray(raw) ? (raw as MemberRow[]) : []);
    } catch {
      toast.error("Erreur réseau.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* HEADER RESPONSIVE */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild className="w-full sm:w-auto h-11 sm:h-10">
          <Link href={`/admin/organizations/${organizationId}/members/new`}>
            Ajouter un membre
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadMembers()}
          disabled={loading}
          className="w-full sm:w-auto h-11 sm:h-10"
        >
          Actualiser
        </Button>
      </div>

      {/* TITLE */}
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Membres</h2>
        <Separator />
      </div>

      {/* CONTENT */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun membre pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border bg-card p-4 shadow-sm transition hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                {/* LEFT */}
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {m.user.name?.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm sm:text-base font-medium">
                      {m.user.name}
                    </p>

                    <p className="truncate text-xs sm:text-sm text-muted-foreground">
                      {m.user.email}
                    </p>

                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {orgRoleLabel(m.role.split(",")[0]?.trim())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTION */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted">
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(
                          `/admin/organizations/${organizationId}/members/${m.id}/edit`,
                        )
                      }
                    >
                      Modifier
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* BACK */}
      <Button
        variant="ghost"
        asChild
        className="w-full sm:w-fit justify-center sm:justify-start"
      >
        <Link href={`/admin/organizations/${organizationId}`}>
          ← Accueil organisation
        </Link>
      </Button>
    </div>
  );
}
