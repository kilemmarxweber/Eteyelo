"use client";

import { useRefresh } from "@/src/hooks/RefreshContext";
import Schedule from "./components/schedule";
import { use } from "react";
import { Card } from "@/components/ui/card";
import { IconList } from "@tabler/icons-react";

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
        <IconList size={18} />
        <span className="text-sm">
          Vue d'ensemble de tous les eleves inscrits
        </span>
      </div>
      <Card
        variant="elevated"
        padding="none"
        className="p-4 rounded-md border max-h-[70vh] overflow-auto"
      >
        <Schedule classeId={classeId} mode="create" key={refreshKey} />
      </Card>
    </div>
  );
}
