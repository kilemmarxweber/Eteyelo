"use client";

import { useRefresh } from "@/src/hooks/RefreshContext";
import Schedule from "./components/schedule";
import { use } from "react";
import { IconCalendarTime } from "@tabler/icons-react";

export default function Teaching({
  params,
}: {
  params: Promise<{ classeId: string }>;
}) {
  const { classeId } = use(params);
  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconCalendarTime size={18} />
        <span className="text-sm">
          Composez, consultez et imprimez l'horaire hebdomadaire de la classe
        </span>
      </div>
      <Schedule classeId={classeId} mode="create" key={refreshKey} />
    </div>
  );
}
