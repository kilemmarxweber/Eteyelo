"use client";

import { useRefresh } from "@/src/hooks/RefreshContext";
import Schedule from "./[classeId]/components/schedule";
import { Card } from "@/components/ui/card";
import { IconList } from "@tabler/icons-react";
import { useParams } from "next/navigation";

export default function Teaching() {
  const { classeId } = useParams<{ classeId: string }>();

  const { refreshKey, refresh } = useRefresh();

  const handleEnrollmentAction = () => {
    refresh();
  };

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
        <Schedule classeId={classeId} mode="create" />
      </Card>
    </div>
  );
}
