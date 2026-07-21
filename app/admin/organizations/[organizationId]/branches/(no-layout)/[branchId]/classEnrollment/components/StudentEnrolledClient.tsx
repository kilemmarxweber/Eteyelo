"use client";

import { Card } from "@/components/ui/card";
import { IconList } from "@tabler/icons-react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import EnrollmentList from "../[classeId]/components/EnrollmentTable";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

export default function StudentEnrolledClient({
  classeId,
}: {
  classeId: string;
}) {
  const { refreshKey } = useRefresh();
  const peopleLabels = useBranchPeopleLabels();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconList size={18} />
        <span className="text-sm">
          Vue d&apos;ensemble de tous les {peopleLabels.studentPluralLower} inscrits
        </span>
      </div>

      <Card className="p-4 max-h-[70vh] overflow-auto">
        <EnrollmentList params={{ classeId }} key={refreshKey} />
      </Card>
    </div>
  );
}
