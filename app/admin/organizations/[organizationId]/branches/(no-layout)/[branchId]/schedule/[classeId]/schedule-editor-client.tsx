"use client";

import { useRefresh } from "@/src/hooks/RefreshContext";
import { notifyScheduleOptionsUpdated } from "../components/CourseSidebar";
import Schedule from "./components/schedule";

export default function ScheduleEditorClient({
  classeId,
}: {
  classeId: string;
}) {
  const { refreshKey } = useRefresh();

  return (
    <Schedule
      classeId={classeId}
      mode="create"
      key={refreshKey}
      onScheduleAction={notifyScheduleOptionsUpdated}
    />
  );
}
