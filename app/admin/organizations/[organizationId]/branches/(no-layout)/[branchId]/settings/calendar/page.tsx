"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconCalendarCog, IconExternalLink, IconPencil, IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getCalendarSettingsAction, saveEventTypeAction } from "../settings.action";

type EventTypeItem = Awaited<ReturnType<typeof getCalendarSettingsAction>>[number];

export default function CalendarSettingsPage() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const [items, setItems] = useState<EventTypeItem[]>([]);
  const [editing, setEditing] = useState<EventTypeItem | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const operationalHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/CalendarEvent`;

  const load = useCallback(() => startTransition(async () => {
    try { setItems(await getCalendarSettingsAction()); } catch (error) { toast.error(error instanceof Error ? error.message : "Chargement impossible."); }
  }), []);
  useEffect(() => load(), [load]);

  function showForm(item?: EventTypeItem) { setEditing(item ?? null); setName(item?.name ?? ""); setOpen(true); }
  function submit() {
    startTransition(async () => {
      try {
        const result = await saveEventTypeAction({ id: editing?.id, name });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message); setOpen(false); setEditing(null); setName(""); load();
      } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible."); }
    });
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Calendrier scolaire</h2><Badge variant="outline-primary" icon={<IconCalendarCog size={14} />}>Paramètres</Badge></div>
        <p className="text-sm text-muted-foreground">Configurez les catégories utilisées pour classer les événements.</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={operationalHref}><IconExternalLink className="mr-2 size-4" />Ouvrir le calendrier</Link></Button>
        <Button onClick={() => showForm()}><IconPlus className="mr-2 size-4" />Ajouter un type</Button></div>
    </div>

    <div className="overflow-hidden rounded-md border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="px-3 py-2">Type d'événement</th><th className="px-3 py-2">Événements</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id} className="border-t"><td className="px-3 py-3 font-medium">{item.name}</td><td className="px-3 py-3 text-muted-foreground">{item._count.events}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => showForm(item)}><IconPencil className="mr-2 size-4" />Modifier</Button></td></tr>)}
        {!items.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">{pending ? "Chargement..." : "Aucun type d'événement configuré."}</td></tr>}</tbody></table></div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Modifier le type" : "Ajouter un type d'événement"}</DialogTitle><DialogDescription>Ce libellé sera proposé dans le formulaire du calendrier.</DialogDescription></DialogHeader>
      <div className="space-y-2"><label htmlFor="event-type-name" className="text-sm font-medium">Nom</label><Input id="event-type-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Congé, réunion, examen" /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="button" disabled={pending || name.trim().length < 3} onClick={submit}>{pending ? "Enregistrement..." : "Enregistrer"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
