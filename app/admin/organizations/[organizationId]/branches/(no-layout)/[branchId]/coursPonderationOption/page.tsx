"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Layout, LayoutBody } from "@/components/custom/layout";

import { useEffect, useMemo, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconAdjustments,
  IconCheck,
  IconSearch,
  IconSettings,
  IconAlertTriangle,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCoursPonderationOptionPageDataAction,
  createCoursOptionPonderationAction,
  updateCoursOptionPonderationAction,
  deleteCoursOptionPonderationAction,
} from "./cours-ponderation-option.action";
import { useBranchRouteGuard } from "@/hooks/use-branch-route-guard";
import { cycleLabel, type Cycle } from "@/lib/cycle";

type PageData = NonNullable<
  Awaited<ReturnType<typeof getCoursPonderationOptionPageDataAction>>[0]
>;
type Ponderation = PageData["ponderations"][number];
type OptionRow = PageData["options"][number];
type CourseRow = PageData["cours"][number];

export default function CoursPonderationOptionPage() {
  useBranchRouteGuard({ routeSuffix: "/coursPonderationOption" });

  const [data, setData] = useState<PageData | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [selectedCycle, setSelectedCycle] = useState<Cycle | "">("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(
    () =>
      startTransition(async () => {
        const [result, error] = await getCoursPonderationOptionPageDataAction();
        if (error || !result) {
          toast.error(error?.message ?? "Chargement impossible");
          return;
        }
        setData(result);
        const first = result.options[0];
        setSelectedOptionId(first?.id ?? "");
        setSelectedCycle(first?.cycle ?? result.cycles[0] ?? "");
      }),
    [],
  );

  const cycleOptions = useMemo(() => {
    if (!data) return [];
    if (selectedCycle) {
      const filtered = data.options.filter(
        (option) => option.cycle === selectedCycle,
      );
      if (filtered.length) return filtered;
    }
    return data.options;
  }, [data, selectedCycle]);

  const selectedOption = cycleOptions.find(
    (option) => option.id === selectedOptionId,
  ) ?? cycleOptions[0];
  const activeOptionId = selectedOption?.id ?? selectedOptionId;
  const isLevelWeighted = selectedOption?.isLevelWeighted ?? false;
  const activeCycle = selectedOption?.cycle ?? selectedCycle;
  const map = useMemo(
    () =>
      new Map(
        (data?.ponderations ?? []).map((item) => [
          `${item.optionId}:${item.coursId}`,
          item,
        ]),
      ),
    [data],
  );
  const rows = useMemo(() => {
    const values = (data?.cours ?? []).map((course) => ({
      course,
      ponderation: map.get(`${activeOptionId}:${course.id}`),
    }));
    const filtered = values.filter(({ course, ponderation }) => {
      const matchesSearch = `${course.codeCours} ${course.nameCours}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        status === "all" ||
        (status === "configured" ? !!ponderation : !ponderation);
      return matchesSearch && matchesStatus;
    });
    return filtered.sort((a, b) =>
      sort === "weight"
        ? (b.ponderation?.ponderation ?? -1) -
          (a.ponderation?.ponderation ?? -1)
        : a.course.nameCours.localeCompare(b.course.nameCours),
    );
  }, [data, map, search, activeOptionId, sort, status]);

  const configured =
    data?.cours.filter((course) =>
      map.has(`${activeOptionId}:${course.id}`),
    ).length ?? 0;
  const missing = (data?.cours.length ?? 0) - configured;
  const weights = (data?.ponderations ?? [])
    .filter((item) => item.optionId === activeOptionId)
    .map((item) => item.ponderation);
  const average = weights.length
    ? weights.reduce((sum, value) => sum + value, 0) / weights.length
    : 0;

  function save(courseId: string, value: number) {
    const isHalfStep =
      Number.isFinite(value) &&
      Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
    if (!isHalfStep || value < 0 || value > 100 || !data) {
      toast.error(
        "La pondération doit être un multiple de 0,5 entre 0 et 100.",
      );
      return;
    }
    const key = `${activeOptionId}:${courseId}`;
    const previous = map.get(key);
    const optimistic: Ponderation = {
      id: previous?.id ?? `temp-${courseId}`,
      coursId: courseId,
      optionId: activeOptionId,
      ponderation: value,
      updatedAt: new Date(),
    };
    setData((current) =>
      current
        ? {
            ...current,
            ponderations: previous
              ? current.ponderations.map((item) =>
                  item.id === previous.id ? optimistic : item,
                )
              : [...current.ponderations, optimistic],
          }
        : current,
    );
    setSavingId(courseId);
    startTransition(async () => {
      const [saved, error] = previous
        ? await updateCoursOptionPonderationAction({
            id: previous.id,
            coursId: courseId,
            optionId: activeOptionId,
            ponderation: value,
          })
        : await createCoursOptionPonderationAction({
            coursId: courseId,
            optionId: activeOptionId,
            ponderation: value,
          });
      setSavingId(null);
      if (error || !saved) {
        setData((current) =>
          current
            ? {
                ...current,
                ponderations: previous
                  ? current.ponderations.map((item) =>
                      item.coursId === courseId &&
                      item.optionId === activeOptionId
                        ? previous
                        : item,
                    )
                  : current.ponderations.filter(
                      (item) => item.id !== optimistic.id,
                    ),
              }
            : current,
        );
        toast.error(error?.message ?? "Enregistrement impossible");
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              ponderations: current.ponderations.map((item) =>
                item.id === optimistic.id ? saved : item,
              ),
            }
          : current,
      );
      toast.success("Pondération enregistrée");
    });
  }

  function cancel(courseId: string) {
    if (!data) return;
    const key = `${activeOptionId}:${courseId}`;
    const previous = map.get(key);
    if (!previous || previous.id.startsWith("temp-")) {
      toast.error("Aucune pondération configurée à annuler");
      return;
    }

    setData((current) =>
      current
        ? {
            ...current,
            ponderations: current.ponderations.filter(
              (item) => item.id !== previous.id,
            ),
          }
        : current,
    );
    setSavingId(courseId);
    startTransition(async () => {
      const [, error] = await deleteCoursOptionPonderationAction({
        id: previous.id,
      });
      setSavingId(null);
      if (error) {
        setData((current) =>
          current
            ? {
                ...current,
                ponderations: [...current.ponderations, previous],
              }
            : current,
        );
        toast.error(error.message ?? "Annulation impossible");
        return;
      }
      toast.success("Pondération annulée");
    });
  }

  if (!data) {
    return (
      <Layout>
        <LayoutBody className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </LayoutBody>
      </Layout>
    );
  }

  return (
    <BranchPageShell
      title="Pondération des cours"
          description={`Année scolaire : ${data.schoolYear?.nameYear ?? "non configurée"}`}
          badge={
            <Badge variant="outline-primary" icon={<IconAdjustments size={14} />}>
              Enseignement
            </Badge>
          }
          actions={
            <Button variant="outline" onClick={() => setStatus("missing")}>
              <IconSettings className="mr-2 size-4" />
              Configurer les manquants
            </Button>
          }
    >
      <Card className="space-y-4 p-4">
          <div
            className={`grid gap-4 ${
              data.cycles.length > 1
                ? "lg:grid-cols-[1fr_1fr_1fr]"
                : "lg:grid-cols-[1fr_1fr]"
            }`}
          >
            {data.cycles.length > 1 ? (
              <div>
                <label className="text-sm font-medium">Cycle</label>
                <Select
                  value={selectedCycle || undefined}
                  onValueChange={(value) => {
                    const cycle = value as Cycle;
                    setSelectedCycle(cycle);
                    const first = data.options.find(
                      (option) => option.cycle === cycle,
                    );
                    setSelectedOptionId(first?.id ?? "");
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Sélectionner un cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.cycles.map((cycle) => (
                      <SelectItem key={cycle} value={cycle}>
                        {cycleLabel(cycle)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <label className="text-sm font-medium">
                {isLevelWeighted ? "Niveau" : "Option active"}
              </label>
              <Select
                value={activeOptionId || undefined}
                onValueChange={setSelectedOptionId}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue
                    placeholder={
                      isLevelWeighted
                        ? "Sélectionner un niveau"
                        : "Sélectionner une option"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {cycleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Contexte actif</p>
              <p className="text-muted-foreground">
                Section : {selectedOption?.section?.nameSection ?? "Toutes"}
              </p>
              <p className="truncate text-muted-foreground">
                Classes :{" "}
                {selectedOption?.classe.map((item) => item.nameClasse).join(", ") ||
                  "Aucune classe"}
              </p>
              {activeCycle === "MATERNELLE" ? (
                <p className="mt-1 text-muted-foreground">
                  Les pondérations sont définies par niveau (Crèche, 1è–3è).
                </p>
              ) : activeCycle === "PRIMAIRE" ? (
                <p className="mt-1 text-muted-foreground">
                  Les pondérations sont définies par niveau (1è–6è).
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary title="Cours configurés" value={configured} tone="success" />
          <Summary
            title="Pondérations manquantes"
            value={missing}
            tone={missing ? "warning" : "success"}
          />
          <Summary title="Moyenne" value={average.toFixed(1)} />
          <Summary title="Total des cours" value={data.cours.length} />
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un cours..."
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="lg:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="configured">Configurés</SelectItem>
                <SelectItem value="missing">Manquants</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Trier par cours</SelectItem>
                <SelectItem value="weight">Trier par poids</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] table-fixed text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    Cours
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {isLevelWeighted ? "Niveau / classes" : "Option / classes"}
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    Pondération
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    Statut
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    Modifié
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ course, ponderation }) => (
                  <PonderationRow
                    key={course.id}
                    course={course}
                    option={selectedOption}
                    ponderation={ponderation}
                    saving={savingId === course.id}
                    onSave={save}
                    onCancel={cancel}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 md:hidden">
            {rows.map(({ course, ponderation }) => (
              <PonderationCard
                key={course.id}
                course={course}
                ponderation={ponderation}
                saving={savingId === course.id}
                onSave={save}
                onCancel={cancel}
              />
            ))}
          </div>

          {!rows.length && (
            <div className="p-10 text-center">
              <IconAlertTriangle className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="font-medium">Aucun cours dans cette vue</p>
              <Button
                variant="link"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}
        </Card>
    </BranchPageShell>
  );
}

function Summary({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone?: "success" | "warning";
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "warning"
            ? "text-amber-600"
            : tone === "success"
              ? "text-emerald-600"
              : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function WeightEditor({
  courseId,
  value,
  configured,
  saving,
  onSave,
  onCancel,
}: {
  courseId: string;
  value?: number;
  configured: boolean;
  saving: boolean;
  onSave: (id: string, value: number) => void;
  onCancel: (id: string) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? 1));
  useEffect(() => setDraft(String(value ?? 1)), [value]);
  const numeric = Number(draft);
  const maxPeriode = Number.isFinite(numeric) ? numeric * 10 : null;

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Input
        className="h-8 w-20 shrink-0"
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 shrink-0 px-2"
        disabled={saving || Number(draft) === value}
        onClick={() => onSave(courseId, Number(draft))}
      >
        {saving ? "..." : <IconCheck className="size-4" />}
      </Button>
      {configured ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 px-2 text-destructive hover:text-destructive"
          disabled={saving}
          title="Annuler la pondération"
          onClick={() => onCancel(courseId)}
        >
          <IconTrash className="size-4" />
        </Button>
      ) : null}
      {maxPeriode != null ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          max {maxPeriode}
        </span>
      ) : null}
    </div>
  );
}

function PonderationRow({
  course,
  option,
  ponderation,
  saving,
  onSave,
  onCancel,
}: {
  course: CourseRow;
  option?: OptionRow;
  ponderation?: Ponderation;
  saving: boolean;
  onSave: (id: string, value: number) => void;
  onCancel: (id: string) => void;
}) {
  const classesLabel =
    option?.classe.map((item) => item.nameClasse).join(", ") || "Aucune classe";
  const optionLabel = option?.displayName ?? option?.nameOption ?? "—";

  return (
    <tr
      className={`border-t ${
        !ponderation ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
      }`}
    >
      <td className="px-3 py-2 align-middle">
        <span className="block truncate font-medium" title={course.nameCours}>
          {course.nameCours}
        </span>
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <span className="shrink-0 font-medium text-foreground">
            {optionLabel}
          </span>
          <span
            className="truncate text-xs text-muted-foreground"
            title={classesLabel}
          >
            {classesLabel}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 align-middle">
        <WeightEditor
          courseId={course.id}
          value={ponderation?.ponderation}
          configured={!!ponderation}
          saving={saving}
          onSave={onSave}
          onCancel={onCancel}
        />
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap">
        <Badge variant={ponderation ? "success" : "warning"}>
          {ponderation ? "Configuré" : "Manquant"}
        </Badge>
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap text-muted-foreground">
        {ponderation
          ? new Date(ponderation.updatedAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </td>
    </tr>
  );
}

function PonderationCard({
  course,
  ponderation,
  saving,
  onSave,
  onCancel,
}: {
  course: CourseRow;
  ponderation?: Ponderation;
  saving: boolean;
  onSave: (id: string, value: number) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <Card className={`space-y-3 p-4 ${!ponderation ? "border-amber-300" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{course.nameCours}</p>
          <p className="text-xs text-muted-foreground">{course.codeCours}</p>
        </div>
        <Badge variant={ponderation ? "success" : "warning"}>
          {ponderation ? "Configuré" : "Manquant"}
        </Badge>
      </div>
      <WeightEditor
        courseId={course.id}
        value={ponderation?.ponderation}
        configured={!!ponderation}
        saving={saving}
        onSave={onSave}
        onCancel={onCancel}
      />
      {ponderation ? (
        <p className="text-xs text-muted-foreground">
          Modifié le{" "}
          {new Date(ponderation.updatedAt).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      ) : null}
    </Card>
  );
}
