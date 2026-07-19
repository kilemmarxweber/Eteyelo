"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconClock,
  IconListDetails,
  IconScan,
  IconUserCheck,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type AttendanceSidebarNavProps = {
  basePath: string;
};

const NAV_ITEMS = [
  {
    title: "Tableau de bord",
    segment: "",
    icon: IconChartBar,
  },
  {
    title: "Pointage",
    segment: "/pointage",
    icon: IconScan,
  },
  {
    title: "Detail des presences",
    segment: "/details",
    icon: IconListDetails,
  },
  {
    title: "Historique",
    segment: "/historique",
    icon: IconClock,
  },
] as const;

export function AttendanceSidebarNav({ basePath }: AttendanceSidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      <div className="mb-3 flex items-center gap-2 border-b border-border/50 pb-3">
        <IconUserCheck size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">Presences</h3>
      </div>

      {NAV_ITEMS.map((item) => {
        const href = `${basePath}${item.segment}`;
        const isActive =
          item.segment === ""
            ? pathname === basePath || pathname === `${basePath}/`
            : pathname.startsWith(href);
        const Icon = item.icon;

        return (
          <Link
            key={item.segment || "dashboard"}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon size={16} />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
