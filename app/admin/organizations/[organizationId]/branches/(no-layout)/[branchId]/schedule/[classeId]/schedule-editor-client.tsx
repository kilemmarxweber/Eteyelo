"use client";

import { useEffect, useState } from "react";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { notifyScheduleOptionsUpdated } from "../components/CourseSidebar";
import Schedule from "./components/schedule";
import { AtelierRotationPanel } from "./components/atelier-rotation-panel";
import { getBranchTypeAction } from "../../classe/classe.action";
import { isAtelierBranch } from "@/lib/branch-capabilities";

export default function ScheduleEditorClient({
  classeId,
}: {
  classeId: string;
}) {
  const { refreshKey } = useRefresh();
  const [isAtelier, setIsAtelier] = useState(false);

  useEffect(() => {
    let ignore = false;
    getBranchTypeAction()
      .then(([res]) => {
        if (ignore) return;
        setIsAtelier(isAtelierBranch(res?.typebranch));
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <Schedule
        classeId={classeId}
        mode="create"
        key={refreshKey}
        onScheduleAction={notifyScheduleOptionsUpdated}
      />
      {isAtelier ? <AtelierRotationPanel classeId={classeId} /> : null}
    </>
  );
}
