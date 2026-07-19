"use client";

import * as React from "react";
import { getStaffBadgeAction } from "../../staff-badge.action";
import { StaffBadgeSection } from "../../components/staff-badge-section";
import type { StaffBadgeData } from "@/lib/staff-badge";

type PersonnelBadgePanelProps = {
  personnelId: string;
  open: boolean;
};

export function PersonnelBadgePanel({ personnelId, open }: PersonnelBadgePanelProps) {
  const [badge, setBadge] = React.useState<StaffBadgeData | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !personnelId) return;

    let cancelled = false;
    setLoading(true);

    void getStaffBadgeAction("personnel", personnelId)
      .then((data) => {
        if (!cancelled) setBadge(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, personnelId]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Chargement de la carte...</p>
    );
  }

  if (!badge) {
    return null;
  }

  return <StaffBadgeSection badge={badge} />;
}
