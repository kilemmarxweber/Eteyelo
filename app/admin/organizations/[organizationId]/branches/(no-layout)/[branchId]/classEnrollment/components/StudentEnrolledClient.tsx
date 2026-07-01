"use client";

import { Card } from "@/components/ui/card";
import { IconList } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import EnrollmentList from "../[classeId]/components/EnrollmentTable";

export default function StudentEnrolledClient({
  classeId,
}: {
  classeId: string;
}) {
  const { refreshKey } = useRefresh();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconList size={18} />
        <span className="text-sm">
          Vue d'ensemble de tous les eleves inscrits
        </span>
      </div>

      <Card className="p-4 max-h-[70vh] overflow-auto">
        <EnrollmentList params={{ classeId }} key={refreshKey} />
      </Card>
    </div>
  );
}
