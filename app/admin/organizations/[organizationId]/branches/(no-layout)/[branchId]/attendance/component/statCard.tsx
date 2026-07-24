import type { LucideIcon } from "lucide-react";

import { BranchStatCard } from "@/components/ui/branch-stat-card";

interface StatCardProps {
  title: string;
  value: number | string;
  change: string;
  icon: LucideIcon;
  bgColor?: string;
  iconColor?: string;
}

export function StatCard({ title, value, change, icon }: StatCardProps) {
  return (
    <BranchStatCard
      label={title}
      value={value}
      description={change}
      icon={icon}
    />
  );
}
