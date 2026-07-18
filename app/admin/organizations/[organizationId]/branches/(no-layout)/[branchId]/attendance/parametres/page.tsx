"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconMapPin, IconUserCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAttendanceSettingsAction,
  saveAttendanceSettingsAction,
} from "../../settings/settings.action";

export default function AttendanceParametresPage() {
  const [radius, setRadius] = useState(100);
  const [coordinates, setCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getAttendanceSettingsAction();
        setRadius(data.attendanceRadius);
        setCoordinates(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Chargement impossible.");
      }
    });
  }, []);

  function submit() {
    startTransition(async () => {
      try {
        const result = await saveAttendanceSettingsAction({ attendanceRadius: radius });
        toast.success(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Parametres de presence</h2>
          <Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>
            Configuration
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurez la validation geographique des pointages du personnel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconMapPin className="size-5" />
            Zone de presence
          </CardTitle>
          <CardDescription>
            Une personne doit se trouver dans ce rayon autour de l&apos;etablissement pour
            valider sa presence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="attendance-radius" className="text-sm font-medium">
                Rayon autorise (metres)
              </label>
              <Input
                id="attendance-radius"
                type="number"
                min={10}
                max={5000}
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Valeur comprise entre 10 et 5 000 metres.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Coordonnees de l&apos;etablissement</p>
              <p className="mt-2 text-muted-foreground">
                Latitude : {coordinates.latitude}
              </p>
              <p className="text-muted-foreground">
                Longitude : {coordinates.longitude}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={submit}
            disabled={pending || radius < 10 || radius > 5000}
          >
            {pending ? "Enregistrement..." : "Enregistrer les parametres"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statuts utilises</CardTitle>
          <CardDescription>
            Les statuts sont unifies dans les formulaires et rapports de presence.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="success">Present</Badge>
          <Badge variant="destructive">Absent</Badge>
          <Badge variant="warning">Retard</Badge>
          <Badge variant="secondary">Excuse</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
