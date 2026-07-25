"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { MapPin } from "lucide-react";

import type { HomeMapLocation } from "@/lib/home/home-data";

import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const RDC_CENTER: [number, number] = [-2.5, 23.5];

function FitBounds({ locations }: { locations: HomeMapLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) {
      map.setView(RDC_CENTER, 5);
      return;
    }

    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 12);
      return;
    }

    const bounds = L.latLngBounds(
      locations.map((location) => [location.latitude, location.longitude]),
    );
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
  }, [locations, map]);

  return null;
}

function formatAddress(location: HomeMapLocation) {
  return [location.adresse, location.commune, location.ville, location.province]
    .filter(Boolean)
    .join(", ");
}

export function HomeBranchesMap({
  locations,
}: {
  locations: HomeMapLocation[];
}) {
  const center = useMemo<[number, number]>(() => {
    if (locations.length === 0) return RDC_CENTER;
    const lat =
      locations.reduce((sum, item) => sum + item.latitude, 0) / locations.length;
    const lng =
      locations.reduce((sum, item) => sum + item.longitude, 0) /
      locations.length;
    return [lat, lng];
  }, [locations]);

  return (
    <div className="h-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm sm:h-[420px] lg:h-full lg:min-h-[420px]">
      <MapContainer
        center={center}
        zoom={locations.length ? 6 : 5}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds locations={locations} />
        {locations.map((location) => (
          <Marker
            key={location.id}
            position={[location.latitude, location.longitude]}
            icon={markerIcon}
          >
            <Popup>
              <div className="min-w-[180px] space-y-1.5">
                <p className="text-sm font-bold text-slate-900">
                  {location.name}
                </p>
                {formatAddress(location) ? (
                  <p className="text-xs leading-5 text-slate-600">
                    <MapPin className="mr-1 inline size-3 text-blue-600" />
                    {formatAddress(location)}
                  </p>
                ) : null}
                <Link
                  href={`/etablissements/${location.id}`}
                  className="inline-block text-xs font-semibold text-blue-700 hover:underline"
                >
                  Voir l&apos;établissement →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
