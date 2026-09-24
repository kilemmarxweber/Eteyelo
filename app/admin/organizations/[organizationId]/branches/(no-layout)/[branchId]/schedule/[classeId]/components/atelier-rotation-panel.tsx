"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteRotationSlotAction,
  getDomainCoursForRotationAction,
  getResolvedRotationSlotsAction,
  upsertRotationSlotAction,
} from "../../rotation.action";
import {
  getPracticalDomainsAction,
  getRoomsAction,
} from "../../../settings/practical-domains.action";
import { Plus, Trash2 } from "lucide-react";

type ResolvedSlot = {
  id: string;
  day: string;
  hour: string;
  domainName: string;
  roomName: string | null;
  label: string;
  weekInCycle: number;
  cycleLength: number;
  isClosed: boolean;
  nameCours: string | null;
  practicalDomainId: string;
  roomId: string | null;
  teacherId: string | null;
  anchorDate: string;
  items: Array<{
    coursId: string;
    nameCours: string;
    sortOrder: number;
    teacherId: string | null;
  }>;
};

const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

export function AtelierRotationPanel({ classeId }: { classeId: string }) {
  const [slots, setSlots] = useState<ResolvedSlot[]>([]);
  const [domains, setDomains] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [rooms, setRooms] = useState<
    Array<{ id: string; name: string; practicalDomainId: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [day, setDay] = useState<string>("Lundi");
  const [hour, setHour] = useState("08:00");
  const [domainId, setDomainId] = useState("");
  const [roomId, setRoomId] = useState<string>("");
  const [anchorDate, setAnchorDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [cycleCoursIds, setCycleCoursIds] = useState<string[]>([]);
  const [domainCours, setDomainCours] = useState<
    Array<{ coursId: string; nameCours: string }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [[resolved], [doms], [rms]] = await Promise.all([
        getResolvedRotationSlotsAction({ classeId }),
        getPracticalDomainsAction(),
        getRoomsAction(),
      ]);
      setSlots((resolved as ResolvedSlot[]) ?? []);
      setDomains(
        (doms ?? []).map((d: { id: string; name: string }) => ({
          id: d.id,
          name: d.name,
        })),
      );
      setRooms(
        (rms ?? []).map(
          (r: {
            id: string;
            name: string;
            practicalDomainId: string | null;
          }) => ({
            id: r.id,
            name: r.name,
            practicalDomainId: r.practicalDomainId,
          }),
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [classeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!domainId) {
      setDomainCours([]);
      setCycleCoursIds([]);
      return;
    }
    getDomainCoursForRotationAction({ practicalDomainId: domainId }).then(
      ([rows]) => {
        const list =
          (rows as Array<{ coursId: string; nameCours: string }> | null) ??
          [];
        setDomainCours(list);
        setCycleCoursIds(list.map((c) => c.coursId));
        const linkedRoom = rooms.find((r) => r.practicalDomainId === domainId);
        if (linkedRoom) setRoomId(linkedRoom.id);
      },
    );
  }, [domainId, rooms]);

  const openCreate = () => {
    setDay("Lundi");
    setHour("08:00");
    setDomainId(domains[0]?.id ?? "");
    setRoomId("");
    setAnchorDate(new Date().toISOString().slice(0, 10));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!domainId || cycleCoursIds.length === 0) {
      toast.error("Domaine et au moins un cours requis");
      return;
    }
    setSaving(true);
    try {
      const [, err] = await upsertRotationSlotAction({
        classeId,
        day: day as (typeof DAYS)[number],
        hour,
        practicalDomainId: domainId,
        roomId: roomId || null,
        teacherId: null,
        anchorDate,
        items: cycleCoursIds.map((coursId, index) => ({
          coursId,
          sortOrder: index,
          teacherId: null,
        })),
      });
      if (err) throw new Error(err.message);
      toast.success("Créneau rotation enregistré");
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const [, err] = await deleteRotationSlotAction({ id });
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Créneau supprimé");
    await load();
  };

  const moveCours = (index: number, dir: -1 | 1) => {
    const next = [...cycleCoursIds];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    setCycleCoursIds(next);
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Rotations labo</CardTitle>
          <CardDescription>
            Cycle de N cours par créneau (ex. Chimie → Biologie). Les jours
            fériés annulent la séance sans décaler le cycle.
          </CardDescription>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Créneau
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun créneau rotationnel. Ajoutez-en un pour ce groupe.
          </p>
        ) : (
          slots.map((slot) => (
            <div
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="space-y-0.5">
                <div className="font-medium">
                  {slot.day} · {slot.hour} — {slot.label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {slot.isClosed ? (
                    <Badge variant="destructive">Fermé</Badge>
                  ) : (
                    <Badge variant="secondary">
                      Semaine {slot.weekInCycle}/{slot.cycleLength}
                    </Badge>
                  )}
                  {slot.nameCours ? (
                    <Badge variant="outline">{slot.nameCours}</Badge>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => remove(slot.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau créneau à rotation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Jour</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Heure</Label>
                <Input
                  type="time"
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Domaine</Label>
              <Select value={domainId} onValueChange={setDomainId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Salle</Label>
              <Select
                value={roomId || "NONE"}
                onValueChange={(v) => setRoomId(v === "NONE" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optionnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Aucune</SelectItem>
                  {rooms
                    .filter(
                      (r) =>
                        !domainId ||
                        !r.practicalDomainId ||
                        r.practicalDomainId === domainId,
                    )
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ancre du cycle (semaine 1)</Label>
              <Input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Ordre du cycle ({cycleCoursIds.length} cours)</Label>
              {cycleCoursIds.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Liez des cours à ce domaine (fiche cours → Domaine
                  pratique).
                </p>
              ) : (
                <ul className="space-y-1">
                  {cycleCoursIds.map((id, index) => {
                    const name =
                      domainCours.find((c) => c.coursId === id)?.nameCours ??
                      id;
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
                      >
                        <span>
                          {index + 1}. {name}
                        </span>
                        <span className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={index === 0}
                            onClick={() => moveCours(index, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={index === cycleCoursIds.length - 1}
                            onClick={() => moveCours(index, 1)}
                          >
                            ↓
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" disabled={saving} onClick={save}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
