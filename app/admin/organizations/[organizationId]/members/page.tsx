"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  ArrowLeft,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [search, setSearch] = useState("");

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

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return members;

    return members.filter((member) => {
      const role = member.role.split(",")[0]?.trim();

      return (
        member.user.name?.toLowerCase().includes(q) ||
        member.user.email?.toLowerCase().includes(q) ||
        orgRoleLabel(role).toLowerCase().includes(q)
      );
    });
  }, [members, search]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-blue-950 p-6 text-white shadow-2xl shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <Users className="size-4" />
              Membres
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Gérez les membres
            </h1>

            <p className="mt-3 text-sm leading-7 text-blue-50 sm:text-base">
              Créez des comptes, attribuez des rôles et modifiez les accès des
              utilisateurs de cette organisation.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="h-11 rounded-full bg-white text-blue-950 hover:bg-blue-50"
              asChild
            >
              <Link href={`/admin/organizations/${organizationId}/members/new`}>
                <Plus className="mr-2 size-4" />
                Ajouter un membre
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadMembers()}
              disabled={loading}
              className="h-11 rounded-full border-white/30 bg-white/10 text-white hover:bg-white hover:text-blue-950"
            >
              <RefreshCcw className="mr-2 size-4" />
              Actualiser
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Liste des membres
            </h2>
            <p className="text-sm text-slate-600">
              {members.length} membre{members.length > 1 ? "s" : ""} enregistré
              {members.length > 1 ? "s" : ""}.
            </p>
          </div>

          <div className="w-full sm:w-[340px]">
            <div className="flex h-12 items-center rounded-full border bg-white px-4 shadow-sm transition focus-within:border-blue-950 focus-within:ring-2 focus-within:ring-blue-950/10">
              <Search className="mr-3 size-4 shrink-0 text-slate-400" />

              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-3xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
          Chargement…
        </section>
      ) : filteredMembers.length === 0 ? (
        <section className="rounded-3xl border border-dashed bg-white p-6 text-sm text-slate-600 shadow-sm">
          Aucun membre trouvé.
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <ul className="divide-y">
            {filteredMembers.map((member) => {
              const role = member.role.split(",")[0]?.trim();

              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-base font-bold text-white">
                      {member.user.name?.charAt(0).toUpperCase() || "?"}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-950">
                        {member.user.name}
                      </h3>

                      <p className="mt-1 flex items-center gap-1 truncate text-sm text-slate-600">
                        <Mail className="size-3.5 shrink-0" />
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="inline-flex rounded-full bg-blue-950/10 px-3 py-1 text-xs font-semibold text-blue-950">
                      {orgRoleLabel(role)}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-blue-950">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(
                              `/admin/organizations/${organizationId}/members/${member.id}/edit`,
                            )
                          }
                        >
                          Modifier
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Button variant="ghost" asChild className="w-fit rounded-full">
        <Link href={`/admin/organizations/${organizationId}`}>
          <ArrowLeft className="mr-2 size-4" />
          Retour organisation
        </Link>
      </Button>
    </div>
  );
}
