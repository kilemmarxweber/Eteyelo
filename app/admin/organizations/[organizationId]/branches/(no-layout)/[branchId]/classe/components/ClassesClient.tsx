"use client";
import { Card } from "@/components/ui/card";
import ClasseList from "./ClassesTable";

export default function Classes({ refreshKey = 0 }: { refreshKey?: number }) {
  //   if (!canRead()) {
  return (
    <Card variant="elevated" padding="none" className="animate-fade-in">
      <ClasseList refreshKey={refreshKey} />
    </Card>
  );
}
//}
