"use client";

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
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom());
  }, [latitude, longitude, map]);

  return null;
}

export default function BranchMapPicker({
  latitude,
  longitude,
  onChange,
}: Props) {
  return (
    <div className="h-[520px] overflow-hidden rounded-[1.5rem]">
      <MapContainer
        center={[latitude, longitude]}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[latitude, longitude]} />

        <ClickHandler onChange={onChange} />
        <RecenterMap latitude={latitude} longitude={longitude} />
      </MapContainer>
    </div>
  );
}
