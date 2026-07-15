"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconExternalLink, IconMapPin, IconUserCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendanceSettingsAction, saveAttendanceSettingsAction } from "../settings.action";

export default function AttendanceSettingsPage() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const [radius, setRadius] = useState(100);
  const [coordinates, setCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [pending, startTransition] = useTransition();
  const operationalHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/attendance`;
  useEffect(() => { startTransition(async () => { try { const data = await getAttendanceSettingsAction(); setRadius(data.attendanceRadius); setCoordinates(data); } catch (error) { toast.error(error instanceof Error ? error.message : "Chargement impossible."); } }); }, []);

  function submit() { startTransition(async () => { try { const result = await saveAttendanceSettingsAction({ attendanceRadius: radius }); toast.success(result.message); } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible."); } }); }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Présences</h2><Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>Paramètres</Badge></div><p className="text-sm text-muted-foreground">Configurez la validation géographique des pointages.</p></div>
      <Button asChild variant="outline"><Link href={operationalHref}><IconExternalLink className="mr-2 size-4" />Ouvrir le tableau de bord</Link></Button></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><IconMapPin className="size-5" />Zone de présence</CardTitle><CardDescription>Une personne doit se trouver dans ce rayon autour de l'établissement pour valider sa présence.</CardDescription></CardHeader>
      <CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="attendance-radius" className="text-sm font-medium">Rayon autorisé (mètres)</label><Input id="attendance-radius" type="number" min={10} max={5000} value={radius} onChange={e => setRadius(Number(e.target.value))} /><p className="text-xs text-muted-foreground">Valeur comprise entre 10 et 5 000 mètres.</p></div>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm"><p className="font-medium">Coordonnées de l'établissement</p><p className="mt-2 text-muted-foreground">Latitude : {coordinates.latitude}</p><p className="text-muted-foreground">Longitude : {coordinates.longitude}</p></div></div>
        <Button type="button" onClick={submit} disabled={pending || radius < 10 || radius > 5000}>{pending ? "Enregistrement..." : "Enregistrer les paramètres"}</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Statuts utilisés</CardTitle><CardDescription>Les statuts sont unifiés dans les formulaires et rapports de présence.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Badge variant="success">Présent</Badge><Badge variant="destructive">Absent</Badge><Badge variant="warning">Retard</Badge><Badge variant="secondary">Excusé</Badge></CardContent></Card>
  </div>;
}
