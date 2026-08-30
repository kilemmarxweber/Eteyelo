"use client";

import { Card } from "@/components/ui/card";
import FraissList from "./components/fraisTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { use } from "react";

export default function StudentEnrolled({
  params,
}: {
  params: Promise<{ classeId: string }>;
}) {
  const { classeId } = use(params);

  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement

  return (
    <Card
      variant="elevated"
      className="mt-0 flex max-h-[70vh] flex-col overflow-hidden rounded-md border p-1 shadow-sm md:p-6"
    >
      {<FraissList params={{ classeId }} key={refreshKey} />}
    </Card>
  );
}
