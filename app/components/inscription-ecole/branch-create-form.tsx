"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  ImageIcon,
  MapPin,
  Navigation,
  Phone,
  School,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HomeNavbar } from "@/components/home-navbar";

import { createBranch } from "./ecole.action";

const BranchMapPicker = dynamic(() => import("./branch-map-picker"), {
  ssr: false,
});

export function BranchCreateForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    image: "",
    adresse: "",
    ville: "",
    pays: "RDC",
    idnat: "",
    tel: "",
    latitude: -4.4419,
    longitude: 15.2663,
    attendanceRadius: 100,
    typebranch: "SECONDAIRE",
  });

  const update = (key: keyof typeof form, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      );

      const data = await res.json();
      const address = data.address;

      update(
        "ville",
        address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.county ||
          "",
      );

      update("pays", address.country || "");
    } catch {
      toast.error("Impossible de recuperer la ville et le pays.");
    }
  };

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        update("latitude", lat);
        update("longitude", lng);

        await reverseGeocode(lat, lng);

        toast.success("Position recuperee avec succes.");
      },
      () => {
        toast.error("Impossible de recuperer votre position.");
      },
    );
  };

  const submit = () => {
    startTransition(async () => {
      const res = await createBranch({
        ...form,
        organizationId,
        typebranch:
          form.typebranch === "PRIMAIRE" ? "PRIMAIRE" : "SECONDAIRE",
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        attendanceRadius: Number(form.attendanceRadius),
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between rounded-3xl bg-blue-950 p-7 text-white shadow-2xl shadow-blue-950/10 md:p-9">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
              <School className="size-4" />
              Inscription ecole
            </div>

            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Ajoutez votre etablissement sur Klambocore
            </h1>

            <p className="mt-4 max-w-[430px] text-sm leading-7 text-blue-50 md:text-base">
              Creez la fiche de votre ecole, indiquez ses coordonnees et
              positionnez-la sur la carte pour la rendre visible aux familles.
            </p>
          </div>

          <div className="mt-10 grid gap-3 text-sm">
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
              <BadgeCheck className="mt-0.5 size-5 shrink-0" />
              <span>
                Une fiche publique claire pour presenter votre etablissement.
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
              <MapPin className="mt-0.5 size-5 shrink-0" />
              <span>
                Une localisation precise pour faciliter la recherche locale.
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-950 text-white">
                <Building2 className="size-5" />
              </span>
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Informations de l'ecole
                </h2>
                <p className="text-sm text-slate-500">
                  Les champs essentiels permettent de creer la fiche de base.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-4">
              <Input
                placeholder="Nom de l'ecole *"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="h-12 rounded-2xl"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={form.typebranch}
                  onChange={(e) => update("typebranch", e.target.value)}
                  className="h-12 rounded-2xl border border-input bg-background px-3 text-sm"
                >
                  <option value="PRIMAIRE">Primaire</option>
                  <option value="SECONDAIRE">Secondaire</option>
                </select>

                <Input
                  placeholder="ID NAT"
                  value={form.idnat}
                  onChange={(e) => update("idnat", e.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Telephone"
                  value={form.tel}
                  onChange={(e) => update("tel", e.target.value)}
                  className="h-12 rounded-2xl pl-10"
                />
              </div>

              <div className="relative">
                <ImageIcon className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="/uploads/ecole.jpg ou URL image"
                  value={form.image}
                  onChange={(e) => update("image", e.target.value)}
                  className="h-12 rounded-2xl pl-10"
                />
              </div>

              <Input
                placeholder="Adresse"
                value={form.adresse}
                onChange={(e) => update("adresse", e.target.value)}
                className="h-12 rounded-2xl"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Ville"
                  value={form.ville}
                  onChange={(e) => update("ville", e.target.value)}
                  className="h-12 rounded-2xl"
                />

                <Input
                  placeholder="Pays"
                  value={form.pays}
                  onChange={(e) => update("pays", e.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  type="number"
                  placeholder="Latitude"
                  value={form.latitude}
                  onChange={(e) => update("latitude", Number(e.target.value))}
                  className="h-12 rounded-2xl"
                />

                <Input
                  type="number"
                  placeholder="Longitude"
                  value={form.longitude}
                  onChange={(e) => update("longitude", Number(e.target.value))}
                  className="h-12 rounded-2xl"
                />

                <Input
                  type="number"
                  placeholder="Rayon presence"
                  value={form.attendanceRadius}
                  onChange={(e) =>
                    update("attendanceRadius", Number(e.target.value))
                  }
                  className="h-12 rounded-2xl"
                />
              </div>

              <Button
                type="button"
                onClick={useCurrentLocation}
                variant="outline"
                className="h-12 rounded-full border-blue-950/20 text-blue-950 hover:bg-blue-50"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Utiliser ma position actuelle
              </Button>

              <Button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="h-14 rounded-full bg-blue-950 text-base font-semibold text-white hover:bg-blue-900"
              >
                {isPending ? "Creation en cours..." : "Creer l'ecole"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 px-2">
              <MapPin className="h-5 w-5 text-blue-950" />
              <h2 className="text-xl font-bold text-slate-950">
                Emplacement de l'ecole
              </h2>
            </div>

            <BranchMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={async (lat, lng) => {
                update("latitude", lat);
                update("longitude", lng);

                await reverseGeocode(lat, lng);
              }}
            />
            <p className="mt-4 px-2 text-sm text-slate-500">
              Cliquez sur la carte pour pointer l'emplacement exact de l'ecole.
              Par defaut, la carte est centree sur Kinshasa, RDC.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
