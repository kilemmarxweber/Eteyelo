"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptionsAction } from "../../option/option.action";
import { type IOption } from "@/src/interfaces/Option";

const PAGE_SIZE = 8;

export function OptionSidebar() {
  const [options, setOptions] = useState<IOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const router = useRouter();
  const params = useParams<{ organizationId: string; branchId: string; classeId?: string }>();

  useEffect(() => { void (async () => {
    const [result, error] = await getOptionsAction();
    if (error) toast.error(error.message ?? "Impossible de charger les classes");
    else setOptions(result ?? []);
    setLoading(false);
  })(); }, []);

  const classes = useMemo(() => options.flatMap(option => (option.classes ?? []).map(classe => ({ id: classe.id, name: classe.nameClasse, code: classe.codeClasse, option: option.nameOption }))), [options]);
  const filtered = useMemo(() => classes.filter(item => `${item.name} ${item.code} ${item.option}`.toLowerCase().includes(search.toLowerCase())), [classes, search]);
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  if (loading) return <div className="space-y-2">{[1,2,3,4].map(item => <Skeleton key={item} className="h-16" />)}</div>;
  return <div className="flex min-h-0 flex-1 flex-col"><div className="relative mb-3"><IconSearch className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Rechercher une classe..." className="pl-9" /></div>
    <div className="min-h-0 flex-1 overflow-y-auto">{visible.map(item => <button key={item.id} type="button" onClick={() => router.push(`/admin/organizations/${params.organizationId}/branches/${params.branchId}/frais/${item.id}`)} className={`mb-2 w-full rounded-lg border p-3 text-left transition ${params.classeId === item.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><div className="flex justify-between gap-2"><span className="font-medium">{item.name}</span>{params.classeId === item.id && <Badge variant="success">Active</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{item.code} · {item.option}</p></button>)}{!visible.length && <p className="p-6 text-center text-sm text-muted-foreground">Aucune classe trouvée.</p>}</div>
    <div className="mt-2 flex items-center justify-between border-t pt-2"><Button size="icon" variant="ghost" disabled={!page} onClick={() => setPage(value => value - 1)}><IconChevronLeft className="size-4" /></Button><span className="text-xs">Page {page + 1}/{pages}</span><Button size="icon" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}><IconChevronRight className="size-4" /></Button></div>
  </div>;
}
