"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useSession } from "@/lib/auth-client";
import {
  IconCalendarCog,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import {
  getCalendarSettingsAction,
  saveEventTypeAction,
} from "../settings.action";
import {
  archiveCalendarEvent,
  getCalendarEvents,
} from "../../CalendarEvent/CalendarEvent.acton";
import type { ICalendarEvent } from "@/src/interfaces/CalendarEvent";
import { CalendarEventForm } from "./components/calendar-event-form";
import { normalizeImageSrc, cn } from "@/lib/utils";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";

type EventTypeItem = Awaited<ReturnType<typeof getCalendarSettingsAction>>[number];
type CalendarTab = "events" | "types";

function formatRange(start: Date | string, end?: Date | string | null) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const startLabel = startDate.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endDate) return startLabel;
  return `${startLabel} → ${endDate.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function CalendarSettingsPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<CalendarTab>("events");
  const [eventTypes, setEventTypes] = useState<EventTypeItem[]>([]);
  const [events, setEvents] = useState<ICalendarEvent[]>([]);
  const [editingType, setEditingType] = useState<EventTypeItem | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ICalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(false);
  const [, startTransition] = useTransition();

  const canManage = canAccessBranchOrgSettings(session);

  const loadTypes = useCallback(async () => {
    try {
      setEventTypes(await getCalendarSettingsAction());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Chargement impossible.",
      );
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const [data, error] = await getCalendarEvents();
      if (error) throw new Error(error.message);
      setEvents(data || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Chargement impossible.",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadTypes(), loadEvents()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEvents, loadTypes]);

  function openTypeForm(item?: EventTypeItem) {
    setEditingType(item ?? null);
    setTypeName(item?.name ?? "");
    setTypeOpen(true);
  }

  function closeTypeForm(open: boolean) {
    setTypeOpen(open);
    if (!open) {
      setEditingType(null);
      setTypeName("");
    }
  }

  async function submitType() {
    const name = typeName.trim();
    if (name.length < 3 || savingType) return;

    setSavingType(true);
    try {
      const result = await saveEventTypeAction({
        id: editingType?.id,
        name,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      closeTypeForm(false);
      await loadTypes();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSavingType(false);
    }
  }

  function openEventForm(event?: ICalendarEvent) {
    setEditingEvent(event ?? null);
    setEventOpen(true);
  }

  function handleEventSuccess() {
    setEventOpen(false);
    setEditingEvent(null);
    void loadEvents();
    void loadTypes();
  }

  function archiveEvent(event: ICalendarEvent) {
    startTransition(async () => {
      try {
        const [, error] = await archiveCalendarEvent({ id: event.id });
        if (error) throw new Error(error.message);
        toast.success("Evenement archive.");
        await loadEvents();
        await loadTypes();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Archivage impossible.",
        );
      }
    });
  }

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Calendrier scolaire</h2>
            <Badge
              variant="outline-primary"
              icon={<IconCalendarCog size={14} />}
            >
              Calendrier
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Creez les evenements, ajoutez une image et traduisez le titre et la
            description.
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as CalendarTab)}
          className="space-y-4"
        >
          <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:flex-row lg:items-center lg:justify-between">
            {canManage ? (
              <Button
                type="button"
                className="self-start lg:self-auto"
                onClick={() =>
                  tab === "types" ? openTypeForm() : openEventForm()
                }
              >
                <IconPlus className="mr-2 size-4" />
                {tab === "types" ? "Ajouter un type" : "Ajouter un evenement"}
              </Button>
            ) : (
              <div
                className="hidden min-h-9 w-full lg:block lg:max-w-md"
                aria-hidden
              />
            )}
            <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 border border-primary/20 bg-primary/10 lg:w-auto">
              <TabsTrigger
                value="events"
                className="gap-1.5 text-xs text-primary/70 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                Evenements
              </TabsTrigger>
              <TabsTrigger
                value="types"
                className="gap-1.5 text-xs text-primary/70 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                Types
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="events" className="mt-0 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {loading
                  ? "Chargement..."
                  : "Aucun evenement. Ajoutez le premier evenement du calendrier."}
              </div>
            ) : (
              <div className="grid gap-3">
                {events.map((event) => (
                  <article
                    key={event.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center"
                  >
                    <div className="relative h-20 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-28">
                      {event.image ? (
                        <Image
                          src={normalizeImageSrc(event.image)}
                          alt={event.title || "Evenement"}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Sans image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">
                          {event.title || "Sans titre"}
                        </h3>
                        {event.eventType?.name ? (
                          <Badge variant="secondary">{event.eventType.name}</Badge>
                        ) : null}
                        {event.titleI18n &&
                        Object.values(event.titleI18n).filter(Boolean).length >
                          1 ? (
                          <Badge variant="outline">Multilingue</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatRange(event.dateStart, event.dateEnd)}
                      </p>
                      {event.location ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {event.location}
                        </p>
                      ) : null}
                      {event.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      ) : null}
                    </div>

                    {canManage ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEventForm(event)}
                        >
                          <IconPencil className="mr-1 size-4" />
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => archiveEvent(event)}
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="types" className="mt-0 space-y-3">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Type d&apos;evenement</th>
                    <th className="px-3 py-2">Evenements</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {eventTypes.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-3 font-medium">{item.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {item._count.events}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openTypeForm(item)}
                          >
                            <IconPencil className="mr-2 size-4" />
                            Modifier
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!eventTypes.length ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        {loading ? (
                          "Chargement..."
                        ) : (
                          <div className="space-y-3">
                            <p>Aucun type d&apos;evenement configure.</p>
                            {canManage ? (
                              <Button
                                type="button"
                                onClick={() => openTypeForm()}
                              >
                                <IconPlus className="mr-2 size-4" />
                                Ajouter un type
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={typeOpen} onOpenChange={closeTypeForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Modifier le type" : "Ajouter un type d'evenement"}
              </DialogTitle>
              <DialogDescription>
                Ce libelle sera propose dans le formulaire d&apos;evenement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="event-type-name" className="text-sm font-medium">
                Nom
              </label>
              <Input
                id="event-type-name"
                value={typeName}
                onChange={(event) => setTypeName(event.target.value)}
                placeholder="Ex. Conge, reunion, examen"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitType();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeTypeForm(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={savingType || typeName.trim().length < 3}
                onClick={() => void submitType()}
              >
                {savingType ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={eventOpen}
          onOpenChange={(open) => {
            setEventOpen(open);
            if (!open) setEditingEvent(null);
          }}
        >
          <DialogContent
            className={cn("max-h-[90vh] overflow-y-auto sm:max-w-3xl")}
          >
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Modifier l'evenement" : "Creer un evenement"}
              </DialogTitle>
              <DialogDescription>
                Ajoutez une image et activez les traductions si besoin.
              </DialogDescription>
            </DialogHeader>
            {session?.user?.id ? (
              <CalendarEventForm
                userId={session.user.id}
                mode={editingEvent ? "update" : "create"}
                eventTypes={eventTypes}
                initialEvent={editingEvent}
                onSuccess={handleEventSuccess}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
