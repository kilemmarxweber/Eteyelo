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
import { getScheduleOptionsAction } from "../schedule.action";

type OptionsData = NonNullable<Awaited<ReturnType<typeof getScheduleOptionsAction>>[0]>;
const PAGE_SIZE = 8;

export function OptionSidebar() {
  const [options, setOptions] = useState<OptionsData>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const router = useRouter();
  const params = useParams<{ organizationId: string; branchId: string; classeId?: string }>();

  useEffect(() => {
    void (async () => {
      const [result, error] = await getScheduleOptionsAction();
      if (error) toast.error(error.message ?? "Impossible de charger les classes");
      else setOptions(result ?? []);
      setLoading(false);
    })();
  }, []);

  const classes = useMemo(() => options.flatMap(option =>
    (option.classes ?? []).map(classe => ({
      id: classe.id,
      nameClasse: classe.nameClasse,
      codeClasse: classe.codeClasse,
      optionName: option.nameOption,
    })),
  ), [options]);
  const filtered = useMemo(() => classes.filter(classe =>
    `${classe.nameClasse} ${classe.codeClasse} ${classe.optionName}`.toLowerCase().includes(search.toLowerCase()),
  ), [classes, search]);
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function selectClass(classId: string) {
    router.push(`/admin/organizations/${params.organizationId}/branches/${params.branchId}/schedule/${classId}`);
  }

  if (loading) return <div className="space-y-2">{[1,2,3,4].map(item => <Skeleton key={item} className="h-16 w-full" />)}</div>;

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="relative mb-3">
      <IconSearch className="absolute left-3 top-3 size-4 text-muted-foreground" />
      <Input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Rechercher une classe..." className="pl-9" />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {paginated.map(classe => <button key={classe.id} type="button" onClick={() => selectClass(classe.id)} className={`mb-2 w-full rounded-lg border p-3 text-left transition ${params.classeId === classe.id ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted"}`}>
        <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{classe.nameClasse}</p><p className="mt-1 text-xs text-muted-foreground">{classe.codeClasse}</p></div>{params.classeId === classe.id && <Badge variant="success">Active</Badge>}</div>
        <p className="mt-2 truncate text-xs text-muted-foreground">{classe.optionName}</p>
      </button>)}
      {!paginated.length && <p className="p-6 text-center text-sm text-muted-foreground">Aucune classe trouvée.</p>}
    </div>
    <div className="mt-2 flex items-center justify-between border-t pt-2">
      <Button type="button" size="icon" variant="ghost" disabled={page === 0} onClick={() => setPage(value => value - 1)}><IconChevronLeft className="size-4" /></Button>
      <span className="text-xs text-muted-foreground">Page {page + 1}/{totalPages}</span>
      <Button type="button" size="icon" variant="ghost" disabled={page + 1 >= totalPages} onClick={() => setPage(value => value + 1)}><IconChevronRight className="size-4" /></Button>
    </div>
  </div>;
}
