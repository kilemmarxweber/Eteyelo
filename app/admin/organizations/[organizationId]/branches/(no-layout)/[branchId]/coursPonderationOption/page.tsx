"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconAdjustments, IconCheck, IconSearch, IconSettings, IconAlertTriangle } from "@tabler/icons-react";
import { toast } from "sonner";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getCoursPonderationOptionPageDataAction, createCoursOptionPonderationAction, updateCoursOptionPonderationAction } from "./cours-ponderation-option.action";
import { useBranchRouteGuard } from "@/hooks/use-branch-route-guard";

type PageData = NonNullable<Awaited<ReturnType<typeof getCoursPonderationOptionPageDataAction>>[0]>;
type Ponderation = PageData["ponderations"][number];

export default function CoursPonderationOptionPage() {
  useBranchRouteGuard({ routeSuffix: "/coursPonderationOption" });

  const [data, setData] = useState<PageData | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => startTransition(async () => {
    const [result, error] = await getCoursPonderationOptionPageDataAction();
    if (error || !result) {
      toast.error(error?.message ?? "Chargement impossible");
      return;
    }
    setData(result);
    setSelectedOptionId(result.isPrimary ? result.primaryOptionId ?? "" : result.options[0]?.id ?? "");
  }), []);

  const selectedOption = data?.options.find(option => option.id === selectedOptionId);
  const map = useMemo(() => new Map((data?.ponderations ?? []).map(item => [`${item.optionId}:${item.coursId}`, item])), [data]);
  const rows = useMemo(() => {
    const values = (data?.cours ?? []).map(course => ({ course, ponderation: map.get(`${selectedOptionId}:${course.id}`) }));
    const filtered = values.filter(({ course, ponderation }) => {
      const matchesSearch = `${course.codeCours} ${course.nameCours}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = status === "all" || (status === "configured" ? !!ponderation : !ponderation);
      return matchesSearch && matchesStatus;
    });
    return filtered.sort((a, b) => sort === "weight" ? (b.ponderation?.ponderation ?? -1) - (a.ponderation?.ponderation ?? -1) : a.course.nameCours.localeCompare(b.course.nameCours));
  }, [data, map, search, selectedOptionId, sort, status]);

  const configured = data?.cours.filter(course => map.has(`${selectedOptionId}:${course.id}`)).length ?? 0;
  const missing = (data?.cours.length ?? 0) - configured;
  const weights = (data?.ponderations ?? []).filter(item => item.optionId === selectedOptionId).map(item => item.ponderation);
  const average = weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : 0;

  function save(courseId: string, value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 100 || !data) {
      toast.error("La pondération doit être un entier entre 0 et 100.");
      return;
    }
    const key = `${selectedOptionId}:${courseId}`;
    const previous = map.get(key);
    const optimistic: Ponderation = { id: previous?.id ?? `temp-${courseId}`, coursId: courseId, optionId: selectedOptionId, ponderation: value, updatedAt: new Date() };
    setData(current => current ? { ...current, ponderations: previous ? current.ponderations.map(item => item.id === previous.id ? optimistic : item) : [...current.ponderations, optimistic] } : current);
    setSavingId(courseId);
    startTransition(async () => {
      const [saved, error] = previous
        ? await updateCoursOptionPonderationAction({ id: previous.id, coursId: courseId, optionId: selectedOptionId, ponderation: value })
        : await createCoursOptionPonderationAction({ coursId: courseId, optionId: selectedOptionId, ponderation: value });
      setSavingId(null);
      if (error || !saved) {
        setData(current => current ? { ...current, ponderations: previous ? current.ponderations.map(item => item.coursId === courseId && item.optionId === selectedOptionId ? previous : item) : current.ponderations.filter(item => item.id !== optimistic.id) } : current);
        toast.error(error?.message ?? "Enregistrement impossible");
        return;
      }
      setData(current => current ? { ...current, ponderations: current.ponderations.map(item => item.id === optimistic.id ? saved : item) } : current);
      toast.success("Pondération enregistrée");
    });
  }

  if (!data) return <Layout><LayoutBody className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid gap-3 md:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-80" /></LayoutBody></Layout>;

  return <Layout><LayoutBody className="space-y-5">
    <PageHeader title="Pondération des cours" description={`Année scolaire : ${data.schoolYear?.nameYear ?? "non configurée"}`} badge={<Badge variant="outline-primary" icon={<IconAdjustments size={14} />}>Enseignement</Badge>} actions={<Button variant="outline" onClick={() => setStatus("missing")}><IconSettings className="mr-2 size-4" />Configurer les manquants</Button>} />

    <Card className="space-y-4 p-4"><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><div><label className="text-sm font-medium">Option active</label><Select value={selectedOptionId} onValueChange={setSelectedOptionId} disabled={data.isPrimary}><SelectTrigger className="mt-2"><SelectValue placeholder="Sélectionner une option" /></SelectTrigger><SelectContent>{data.options.map(option => <SelectItem key={option.id} value={option.id}>{option.nameOption}</SelectItem>)}</SelectContent></Select></div><div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">Contexte actif</p><p className="text-muted-foreground">Section : {selectedOption?.section?.nameSection ?? "Toutes"}</p><p className="text-muted-foreground">Classes : {selectedOption?.classe.map(item => item.nameClasse).join(", ") || "Aucune classe"}</p></div></div></Card>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary title="Cours configurés" value={configured} tone="success" /><Summary title="Pondérations manquantes" value={missing} tone={missing ? "warning" : "success"} /><Summary title="Moyenne" value={average.toFixed(1)} /><Summary title="Total des cours" value={data.cours.length} /></div>

    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b p-4 lg:flex-row"><div className="relative flex-1"><IconSearch className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un cours..." className="pl-9" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="lg:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem><SelectItem value="configured">Configurés</SelectItem><SelectItem value="missing">Manquants</SelectItem></SelectContent></Select><Select value={sort} onValueChange={setSort}><SelectTrigger className="lg:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Trier par cours</SelectItem><SelectItem value="weight">Trier par poids</SelectItem></SelectContent></Select></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead className="bg-muted/40 text-left"><tr><th className="p-3">Cours</th><th className="p-3">Option / classes</th><th className="p-3">Pondération</th><th className="p-3">Statut</th><th className="p-3">Dernière modification</th></tr></thead><tbody>{rows.map(({ course, ponderation }) => <PonderationRow key={course.id} course={course} option={selectedOption} ponderation={ponderation} saving={savingId === course.id} onSave={save} />)}</tbody></table></div>
      <div className="grid gap-3 p-3 md:hidden">{rows.map(({ course, ponderation }) => <PonderationCard key={course.id} course={course} ponderation={ponderation} saving={savingId === course.id} onSave={save} />)}</div>
      {!rows.length && <div className="p-10 text-center"><IconAlertTriangle className="mx-auto mb-2 size-8 text-muted-foreground" /><p className="font-medium">Aucun cours dans cette vue</p><Button variant="link" onClick={() => { setSearch(""); setStatus("all"); }}>Réinitialiser les filtres</Button></div>}
    </Card>
  </LayoutBody></Layout>;
}

function Summary({ title, value, tone }: { title: string; value: string | number; tone?: "success" | "warning" }) { return <Card className="p-4"><p className="text-sm text-muted-foreground">{title}</p><p className={`mt-1 text-2xl font-bold ${tone === "warning" ? "text-amber-600" : tone === "success" ? "text-emerald-600" : ""}`}>{value}</p></Card>; }
function WeightEditor({ courseId, value, saving, onSave }: { courseId: string; value?: number; saving: boolean; onSave: (id: string, value: number) => void }) { const [draft, setDraft] = useState(String(value ?? 1)); useEffect(() => setDraft(String(value ?? 1)), [value]); return <div className="flex items-center gap-2"><Input className="w-24" type="number" min={0} max={100} value={draft} onChange={e => setDraft(e.target.value)} /><Button size="sm" variant="outline" disabled={saving || Number(draft) === value} onClick={() => onSave(courseId, Number(draft))}>{saving ? "..." : <IconCheck className="size-4" />}</Button></div>; }
function PonderationRow({ course, option, ponderation, saving, onSave }: any) { return <tr className={`border-t ${!ponderation ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}><td className="p-3"><p className="font-medium">{course.nameCours}</p><p className="text-xs text-muted-foreground">{course.codeCours}</p></td><td className="p-3 text-muted-foreground">{option?.nameOption}<span className="block text-xs">{option?.classe.map((item: any) => item.nameClasse).join(", ") || "Aucune classe"}</span></td><td className="p-3"><WeightEditor courseId={course.id} value={ponderation?.ponderation} saving={saving} onSave={onSave} /></td><td className="p-3"><Badge variant={ponderation ? "success" : "warning"}>{ponderation ? "Configuré" : "Manquant"}</Badge></td><td className="p-3 text-muted-foreground">{ponderation ? new Date(ponderation.updatedAt).toLocaleString("fr-FR") : "—"}</td></tr>; }
function PonderationCard({ course, ponderation, saving, onSave }: any) { return <Card className={`space-y-3 p-4 ${!ponderation ? "border-amber-300" : ""}`}><div className="flex justify-between gap-2"><div><p className="font-medium">{course.nameCours}</p><p className="text-xs text-muted-foreground">{course.codeCours}</p></div><Badge variant={ponderation ? "success" : "warning"}>{ponderation ? "Configuré" : "Manquant"}</Badge></div><WeightEditor courseId={course.id} value={ponderation?.ponderation} saving={saving} onSave={onSave} />{ponderation && <p className="text-xs text-muted-foreground">Modifié le {new Date(ponderation.updatedAt).toLocaleString("fr-FR")}</p>}</Card>; }
