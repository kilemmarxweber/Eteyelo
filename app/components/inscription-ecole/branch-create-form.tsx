"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, MapPin, Phone, ImageIcon, Navigation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBranch } from "./ecole.action";
import { HomeNavbar } from "@/components/home-navbar";

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
    code: "",
    image: "",
    adresse: "",
    ville: "",
    pays: "RDC",
    idnat: "",
    tel: "",
    latitude: -4.4419,
    longitude: 15.2663,
    attendanceRadius: 100,
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
      toast.error("Impossible de récupérer la ville et le pays.");
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

        toast.success("Position récupérée avec succès.");
      },
      () => {
        toast.error("Impossible de récupérer votre position.");
      },
    );
  };

  const submit = () => {
    startTransition(async () => {
      const res = await createBranch({
        ...form,
        organizationId,
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
    <main className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <section className="mx-auto -mt-0 mb-1 max-w-7xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/10 sm:p-8">
            <h2 className="text-3xl font-black text-blue-950">
              Informations de l’école
            </h2>

            <div className="mt-8 grid gap-4">
              <Input
                placeholder="Nom de l’école *"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="h-12 rounded-2xl"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Code école"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                  className="h-12 rounded-2xl"
                />

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
                  placeholder="Téléphone"
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
                  placeholder="Rayon présence"
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
                className="h-12 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Utiliser ma position actuelle
              </Button>

              <Button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="h-14 rounded-full bg-gradient-to-r from-blue-700 via-cyan-500 to-blue-700 text-base font-black text-white shadow-[0_0_30px_rgba(34,211,238,.35)] hover:shadow-[0_0_45px_rgba(34,211,238,.65)]"
              >
                {isPending ? "Création en cours..." : "Créer l’école"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/10">
            <div className="mb-4 flex items-center gap-2 px-2">
              <MapPin className="h-5 w-5 text-blue-700" />
              <h2 className="text-xl font-black text-blue-950">
                Emplacement de l’école
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
              Cliquez sur la carte pour pointer l’emplacement exact de l’école.
              Par défaut, la carte est centrée sur Kinshasa, RDC.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
