"use client";
import { Card } from "@/components/ui/card";
import ClasseList from "./ClassesTable";
import { useState } from "react";

export default function Classes() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const handleClasseAction = () => {
    setRefreshKey((prev) => prev + 1);
  };
  //   if (!canRead()) {
  return (
    <Card variant="elevated" padding="none" className="animate-fade-in">
      <ClasseList key={refreshKey} />
    </Card>
  );
}
//}
