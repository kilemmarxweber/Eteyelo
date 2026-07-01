"use client";

import { Card } from "@/components/ui/card";
import FraissList from "../[classeId]/components/fraisTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { IconList } from "@tabler/icons-react";
import { useSession } from "@/lib/auth-client";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";

export default function FraisClient({ classeId }: { classeId: string }) {
  const { refreshKey } = useRefresh();
  const { data: session } = useSession();

  if (!canAccessTeachingArea(session)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconList size={18} />
        <span className="text-sm">
          Vue d'ensemble de tous les frais scolaires
        </span>
      </div>

      <Card
        variant="elevated"
        padding="none"
        className="p-4 rounded-md border max-h-[70vh] overflow-auto"
      >
        <FraissList params={{ classeId }} key={refreshKey} />
      </Card>
    </div>
  );
}
