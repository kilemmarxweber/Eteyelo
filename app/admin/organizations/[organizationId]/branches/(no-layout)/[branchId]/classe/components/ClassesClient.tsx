"use client";
import { Card } from "@/components/ui/card";
import ClasseList from "./ClassesTable";

type ClasseStats = {
  total: number;
  active: number;
  inactive: number;
};

export default function Classes({
  refreshKey = 0,
  onStats,
}: {
  refreshKey?: number;
  onStats?: (stats: ClasseStats) => void;
}) {
  return (
    <Card variant="elevated" padding="none" className="animate-fade-in">
      <ClasseList refreshKey={refreshKey} onStats={onStats} />
    </Card>
  );
}
