"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { getScheduleOptionsAction } from "../schedule.action";

type OptionsData = NonNullable<
  Awaited<ReturnType<typeof getScheduleOptionsAction>>[0]
>;

const PAGE_SIZE = 8;

export function OptionSidebar() {
  const [options, setOptions] = useState<OptionsData>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const router = useRouter();
  const params = useParams<{
    organizationId: string;
    branchId: string;
    classeId?: string;
  }>();

  useEffect(() => {
    void (async () => {
      const [result, error] = await getScheduleOptionsAction();
      if (error) {
        toast.error(error.message ?? "Impossible de charger les classes");
      } else {
        setOptions(result ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const classes = useMemo(
    () =>
      options.flatMap((option) =>
        (option.classes ?? []).map((classe) => ({
          id: classe.id,
          nameClasse: classe.nameClasse,
          codeClasse: classe.codeClasse,
          optionName: option.nameOption,
          sectionName: option.nameSection ?? "",
        })),
      ),
    [options],
  );

  const filtered = useMemo(
    () =>
      classes.filter((classe) =>
        `${classe.nameClasse} ${classe.codeClasse} ${classe.optionName} ${classe.sectionName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [classes, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  function selectClass(classId: string) {
    router.push(
      `/admin/organizations/${params.organizationId}/branches/${params.branchId}/schedule/${classId}`,
    );
  }

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Rechercher une classe..."
            className="h-9 pl-9"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {filtered.length} classe{filtered.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {paginated.map((classe) => {
          const active = params.classeId === classe.id;

          return (
            <button
              key={classe.id}
              type="button"
              onClick={() => selectClass(classe.id)}
              className={`mb-1 w-full rounded-lg border p-3 text-left transition ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{classe.nameClasse}</span>
                {active ? <Badge variant="success">Active</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {classe.codeClasse}
                {classe.sectionName || classe.optionName
                  ? ` · ${[classe.sectionName, classe.optionName].filter(Boolean).join(" · ")}`
                  : ""}
              </p>
            </button>
          );
        })}

        {!paginated.length ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Aucune classe trouvée.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t p-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={safePage === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
        >
          <IconChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {safePage + 1}/{totalPages}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={safePage + 1 >= totalPages}
          onClick={() => setPage((value) => value + 1)}
        >
          <IconChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
