"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconClock,
  IconFileAnalytics,
  IconListDetails,
  IconScan,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type AttendanceTabsNavProps = {
  basePath: string;
};

const NAV_ITEMS = [
  {
    titleKey: "nav.checkIn",
    segment: "",
    icon: IconScan,
    match: "checkIn",
  },
  {
    titleKey: "nav.dashboard",
    segment: "/tableau",
    icon: IconChartBar,
    match: "prefix",
  },
  {
    titleKey: "nav.details",
    segment: "/details",
    icon: IconListDetails,
    match: "prefix",
  },
  {
    titleKey: "nav.reports",
    segment: "/rapports",
    icon: IconFileAnalytics,
    match: "prefix",
  },
  {
    titleKey: "nav.history",
    segment: "/historique",
    icon: IconClock,
    match: "history",
  },
] as const;

function isTabActive(
  pathname: string,
  basePath: string,
  item: (typeof NAV_ITEMS)[number],
) {
  const href = `${basePath}${item.segment}`;

  if (item.match === "checkIn") {
    return (
      pathname === basePath ||
      pathname === `${basePath}/` ||
      pathname.startsWith(`${basePath}/pointage`)
    );
  }

  if (item.match === "history") {
    return (
      pathname.startsWith(href) || pathname.startsWith(`${basePath}/session`)
    );
  }

  return pathname.startsWith(href);
}

export function AttendanceTabsNav({ basePath }: AttendanceTabsNavProps) {
  const pathname = usePathname();
  const t = useTranslations("attendance");

  return (
    <nav
      aria-label={t("nav.title")}
      className="flex w-full gap-1 overflow-x-auto rounded-xl border border-primary/20 bg-primary/10 p-1"
    >
      {NAV_ITEMS.map((item) => {
        const href = `${basePath}${item.segment}`;
        const isActive = isTabActive(pathname, basePath, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.titleKey}
            href={href}
            className={cn(
              "inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-primary/80 hover:bg-primary/15 hover:text-primary",
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="truncate">{t(item.titleKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
