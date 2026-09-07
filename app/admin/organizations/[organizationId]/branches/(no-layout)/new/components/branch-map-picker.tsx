"use client";

import { cn } from "@/lib/utils";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type Props = {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  showMarker?: boolean;
};

function ClickHandler({ onChange }: { onChange: Props["onChange"] }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

function RecenterMap({
  latitude,
  longitude,
  zoom,
}: {
  latitude: number;
  longitude: number;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], zoom);
  }, [latitude, longitude, map, zoom]);

  return null;
}

export default function BranchMapPicker({
  latitude,
  longitude,
  onChange,
  className,
  showMarker = true,
}: Props) {
  return (
    <div className={cn("h-[520px] overflow-hidden rounded-[1.5rem]", className)}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={showMarker ? 16 : 13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showMarker ? <Marker position={[latitude, longitude]} /> : null}

        <ClickHandler onChange={onChange} />
        <RecenterMap
          latitude={latitude}
          longitude={longitude}
          zoom={showMarker ? 16 : 13}
        />
      </MapContainer>
    </div>
  );
}
