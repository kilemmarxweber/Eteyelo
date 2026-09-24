"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconFlask, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import {
  deleteRoomAction,
  ensurePracticalDomainsAction,
  getPracticalDomainsAction,
  upsertRoomAction,
} from "../practical-domains.action";
import { getBranchTypeAction } from "../../classe/classe.action";
import { isAtelierBranch } from "@/lib/branch-capabilities";

type DomainRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  rooms: Array<{ id: string; name: string; capacity: number | null }>;
  _count: { cours: number };
};

export default function PracticalDomainsSettingsPage() {
  const [isAtelier, setIsAtelier] = useState(false);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [roomName, setRoomName] = useState("");
  const [roomDomainId, setRoomDomainId] = useState<string>("");
  const [roomCapacity, setRoomCapacity] = useState("");

  const load = () => {
    startTransition(async () => {
      const [typeRes] = await getBranchTypeAction();
      const atelier = isAtelierBranch(typeRes?.typebranch);
      setIsAtelier(atelier);
      if (!atelier) {
        setLoaded(true);
        return;
      }
      const [rows, err] = await getPracticalDomainsAction();
      if (err) {
        toast.error(err.message);
        setLoaded(true);
        return;
      }
      setDomains((rows as DomainRow[]) ?? []);
      setLoaded(true);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seed = () => {
    startTransition(async () => {
      const [, err] = await ensurePracticalDomainsAction();
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success("Domaines pratiques initialisés");
      load();
    });
  };

  const addRoom = () => {
    if (!roomName.trim() || !roomDomainId) {
      toast.error("Nom et domaine requis");
      return;
    }
    startTransition(async () => {
      const [, err] = await upsertRoomAction({
        name: roomName.trim(),
        practicalDomainId: roomDomainId,
        capacity: roomCapacity ? Number(roomCapacity) : null,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success("Salle créée");
      setRoomName("");
      setRoomCapacity("");
      load();
    });
  };

  const removeRoom = (id: string) => {
    startTransition(async () => {
      const [, err] = await deleteRoomAction({ id });
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success("Salle supprimée");
      load();
    });
  };

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6 p-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Domaines pratiques &amp; laboratoires
            </h2>
            <p className="text-sm text-muted-foreground">
              Sciences, technique, comptabilité — salles et cours TP pour les
              rotations d&apos;horaire atelier.
            </p>
          </div>
          {isAtelier ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={seed}
            >
              <IconRefresh className="mr-1.5 size-4" />
              Réinitialiser le catalogue
            </Button>
          ) : null}
        </div>

        {!loaded ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !isAtelier ? (
          <Card>
            <CardHeader>
              <CardTitle>Branche non atelier</CardTitle>
              <CardDescription>
                Cette page est réservée aux établissements de type Atelier.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {domains.map((domain) => (
                <Card key={domain.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <IconFlask className="size-5 text-muted-foreground" />
                      <CardTitle className="text-base">{domain.name}</CardTitle>
                    </div>
                    <CardDescription className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary">{domain.code}</Badge>
                      <Badge variant="outline">
                        {domain._count.cours} cours
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {domain.rooms.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Aucune salle liée
                      </p>
                    ) : (
                      domain.rooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                        >
                          <span>
                            {room.name}
                            {room.capacity != null
                              ? ` · ${room.capacity} places`
                              : ""}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={pending}
                            onClick={() => removeRoom(room.id)}
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ajouter une salle</CardTitle>
                <CardDescription>
                  Ex. « Laboratoire sciences » pour le domaine Sciences.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Nom</label>
                  <Input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Laboratoire sciences"
                    className="w-56"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Domaine
                  </label>
                  <Select value={roomDomainId} onValueChange={setRoomDomainId}>
                    <SelectTrigger className="w-52">
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
                  <label className="text-xs text-muted-foreground">
                    Capacité
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={roomCapacity}
                    onChange={(e) => setRoomCapacity(e.target.value)}
                    className="w-24"
                  />
                </div>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={addRoom}
                >
                  <IconPlus className="mr-1.5 size-4" />
                  Ajouter
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
