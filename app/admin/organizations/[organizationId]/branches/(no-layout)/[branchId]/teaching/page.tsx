"use client";

import { Card } from "@/components/ui/card";
import { IconList } from "@tabler/icons-react";

export default function Teaching() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconList size={18} />
        <span className="text-sm">
          Selectionnez une classe pour afficher les cours assignes.
        </span>
      </div>

      <Card
        variant="elevated"
        padding="none"
        className="p-4 rounded-md border max-h-[70vh] overflow-auto"
      >
        <div className="p-6 text-sm text-muted-foreground">
          Aucune classe selectionnee.
        </div>
      </Card>
    </div>
  );
}
