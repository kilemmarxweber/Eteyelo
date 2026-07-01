import {
  IconComponents,
  IconLayoutDashboard,
  IconSchool,
  IconUserPlus,
  IconCalendarEvent,
  IconTableOptions,
  IconSettings,
  IconUsers,
  IconUserPentagon,
  IconUpload,
  IconBook2,
  IconReportMoney,
  IconCalendarClock,
  IconClock,
  IconClock12,
  IconFileDescription,
  IconFolder,
  IconChartBar,
  IconNotebook,
} from "@tabler/icons-react";

export interface NavLink {
  title: string;
  label?: string;
  href: string;
  icon: React.ReactElement;
}

/* ✅ CLEAN RECURSIVE TYPE */
export interface SideLink extends NavLink {
  sub?: SideLink[];
}
