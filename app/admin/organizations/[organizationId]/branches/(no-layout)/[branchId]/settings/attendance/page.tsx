"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconMapPin, IconUserCheck } from "@tabler/icons-react";
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
import { getCurrentGeoCoords } from "@/lib/browser-geolocation";
import { DEFAULT_BRANCH_ATTENDANCE_RADIUS } from "@/lib/branch-form-values";
import { verifyRadius } from "@/lib/attendance-geo";
import {
  getAttendanceSettingsAction,
  saveAttendanceSettingsAction,
} from "../settings.action";

const BranchMapPicker = dynamic(
  () =>
    import("../../../new/components/branch-map-picker").then(
      (mod) => mod.default,
    ),
  { ssr: false },
);

type LiveCheck = {
  distance: number;
  accuracy?: number;
  allowed: boolean;
  effectiveRadius: number;
};

export default function AttendanceSettingsPage() {
  const [radius, setRadius] = useState(DEFAULT_BRANCH_ATTENDANCE_RADIUS);
  const [coordinates, setCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [locating, setLocating] = useState(false);
  const [liveCheck, setLiveCheck] = useState<LiveCheck | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getAttendanceSettingsAction();
        setRadius(data.attendanceRadius ?? DEFAULT_BRANCH_ATTENDANCE_RADIUS);
        setCoordinates({
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Chargement impossible.",
        );
      }
    });
  }, []);

  function submit() {
    startTransition(async () => {
      try {
        const result = await saveAttendanceSettingsAction({
          attendanceRadius: radius,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        });
        toast.success(result.message);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Enregistrement impossible.",
        );
      }
    });
  }

  async function captureSiteFromThisDevice() {
    setLocating(true);
    try {
      const coords = await getCurrentGeoCoords();
      setCoordinates({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setLiveCheck(null);
      toast.success(
        "Point GPS mis a jour depuis cet appareil. Enregistrez pour l'appliquer.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de recuperer votre position.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function testThisDevice() {
    setLocating(true);
    try {
      const coords = await getCurrentGeoCoords();
      const result = verifyRadius(
        coords.latitude,
        coords.longitude,
        coordinates.latitude,
        coordinates.longitude,
        radius,
        coords.accuracy,
      );
      setLiveCheck({
        distance: result.distance,
        accuracy: coords.accuracy,
        allowed: result.allowed,
        effectiveRadius: result.effectiveRadius,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de recuperer votre position.",
      );
    } finally {
      setLocating(false);
    }
  }

  const hasValidSite =
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    !(coordinates.latitude === 0 && coordinates.longitude === 0);

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
            Recapturez le point GPS sur le site (pas depuis un autre PC). Un
            rayon trop petit (10 m) rejette les telephones : 50 m est
            recommande, le GPS ayant souvent 20 a 50 m d&apos;erreur.
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
                Valeur comprise entre 10 et 5 000 metres. 50 m recommande.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Coordonnees de l&apos;etablissement</p>
              <p className="mt-2 text-muted-foreground">
                Latitude : {coordinates.latitude || "—"}
              </p>
              <p className="text-muted-foreground">
                Longitude : {coordinates.longitude || "—"}
              </p>
            </div>
          </div>

          {hasValidSite ? (
            <BranchMapPicker
              latitude={coordinates.latitude}
              longitude={coordinates.longitude}
              onChange={(latitude, longitude) => {
                setCoordinates({ latitude, longitude });
                setLiveCheck(null);
              }}
              className="h-[280px] rounded-xl"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun point GPS valide. Utilisez votre position actuelle sur le
              site.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void captureSiteFromThisDevice()}
              disabled={pending || locating}
            >
              {locating ? "GPS..." : "Definir la zone depuis cet appareil"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void testThisDevice()}
              disabled={pending || locating || !hasValidSite}
            >
              Tester ma position
            </Button>
          </div>

          {liveCheck ? (
            <p
              className={
                liveCheck.allowed
                  ? "text-sm text-emerald-700"
                  : "text-sm text-destructive"
              }
            >
              Distance : {Math.round(liveCheck.distance)} m
              {liveCheck.accuracy != null
                ? ` · precision GPS ${Math.round(liveCheck.accuracy)} m`
                : ""}
              {" · "}
              {liveCheck.allowed
                ? `dans la zone (jusqu'a ${Math.round(liveCheck.effectiveRadius)} m).`
                : "hors zone. Recapturez le point sur le site ou elargissez le rayon."}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={submit}
            disabled={
              pending || locating || radius < 10 || radius > 5000 || !hasValidSite
            }
          >
            {pending ? "Enregistrement..." : "Enregistrer les parametres"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statuts utilises</CardTitle>
          <CardDescription>
            Les statuts sont unifies dans les formulaires et rapports de
            presence.
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
