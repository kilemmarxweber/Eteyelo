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
  const { refreshKey } = useRefresh();

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconCalendarTime size={18} />
        <span className="text-sm">
          Planifiez l&apos;horaire de la semaine (lundi à samedi) dans une seule
          grille
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Schedule classeId={classeId} mode="create" key={refreshKey} />
      </div>
    </div>
  );
}
