"use client";

import { useCallback, useEffect, useState } from "react";
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
  /** Sync grille ↔ liste rotation sans resetter la semaine du panneau. */
  const [atelierSyncToken, setAtelierSyncToken] = useState(0);
  const [scheduleSyncKey, setScheduleSyncKey] = useState(0);

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

  const notifyFromGrid = useCallback(() => {
    notifyScheduleOptionsUpdated();
    setAtelierSyncToken((t) => t + 1);
  }, []);

  const notifyFromRotationList = useCallback(() => {
    notifyScheduleOptionsUpdated();
    setScheduleSyncKey((k) => k + 1);
  }, []);

  return (
    <>
      <Schedule
        classeId={classeId}
        mode="create"
        key={`${refreshKey}-${scheduleSyncKey}`}
        isAtelier={isAtelier}
        onScheduleAction={notifyFromGrid}
      />
      {isAtelier ? (
        <AtelierRotationPanel
          key={`rot-${refreshKey}`}
          classeId={classeId}
          syncToken={atelierSyncToken}
          onChanged={notifyFromRotationList}
        />
      ) : null}
    </>
  );
}
