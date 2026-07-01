"use client";

import EnrollmentList from "./components/TeachingTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { use } from "react";
import { Card } from "@/components/ui/card";

export default function Teaching({
  params,
}: {
  params: Promise<{ classeId: string }>;
}) {
  const { classeId } = use(params);
  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement
  // Fonction de rappel pour rafraîchir la liste
  const handleEnrollmentAction = () => {
    refresh();
  };
  return (
    <Card
      variant="elevated"
      className="mt-0 border p-1 md:p-6 rounded-md shadow-sm max-h-[70vh] overflow-auto"
    >
      {/* Formulaire de création d'enseignant */}
      {<EnrollmentList params={{ classeId }} key={refreshKey} />}
    </Card>
  );
}
