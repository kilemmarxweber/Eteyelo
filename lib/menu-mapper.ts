"use client";

import {
  IconLayoutDashboard,
  IconUsers,
  IconSchool,
  IconSettings,
  IconReportMoney,
  IconCalendarClock,
  IconClock,
  IconUser,
  IconUserPlus,
  IconUserCheck,
  IconUsersGroup,
  IconBook,
  IconBook2,
  IconClipboardList,
  IconCalendarEvent,
  IconBuilding,
  IconSchoolBell,
  IconCash,
  IconWallet,
  IconFileDescription,
  IconNotes,
  IconChartBar,
  IconCalendar,
  IconClipboard,
  IconChalkboard,
  IconBeach,
  IconPencilCheck,
  IconFileStack,
  IconBuildingCommunity,
} from "@tabler/icons-react";

import { SideLink } from "@/src/data/sidelinks";

/* ---------------- ICON MAP ---------------- */
export const iconMap: Record<string, any> = {
  /* ===== GLOBAL ===== */
  dashboard: IconLayoutDashboard,
  users: IconUsers,
  settings: IconSettings,

  /* ===== USERS ===== */
  eleves: IconUser,
  parents: IconUsersGroup,
  personnels: IconUserPlus,
  enseignants: IconUsers,
  /* ===== TEACHING ===== */
  teaching: IconSchoolBell,
  cours: IconBook2,
  affectations: IconClipboardList,
  vacation: IconBeach,
  horaire: IconCalendarClock,

  /* ===== CLASSES ===== */
  classes: IconBuilding,
  schoolyear: IconCalendarEvent,
  sections: IconClipboard,
  options: IconSettings,
  classe: IconSchool,
  inscriptions: IconUserCheck,

  /* ===== FINANCE ===== */
  finance: IconReportMoney,
  frais: IconCash,
  paiement: IconWallet,

  /* ===== CURSUS ===== */
  cursus: IconBook,
  results: IconChartBar,
  notes: IconPencilCheck,
  fiches: IconFileStack,
  ficheCentrale: IconBuildingCommunity,
  /* ===== DEFAULTS ===== */
  calendar: IconCalendar,
  clock: IconClock,
};

/* ---------------- ICON RESOLVER ---------------- */
function resolveIcon(icon: any) {
  if (!icon) return IconLayoutDashboard;
  if (typeof icon === "string") return iconMap[icon] ?? IconLayoutDashboard;
  return icon;
}

/* ---------------- MENU BUILDER WITH ORDER ---------------- */
export function buildSideLinksFromMenus(menus: any[]): SideLink[] {
  if (!menus) return [];

  const map = new Map<string, any>();

  /* 1. CREATE NODES */
  for (const m of menus) {
    map.set(m.id, {
      id: m.id,
      title: m.name,
      href: m.href,
      icon: resolveIcon(m.icon),
      sub: [],
      parentId: m.parentId,
      order: m.order ?? 0,
    });
  }

  const tree: any[] = [];

  /* 2. BUILD TREE */
  for (const node of map.values()) {
    if (node.parentId) {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.sub.push(node);
      }
    } else {
      tree.push(node);
    }
  }

  /* 3. SORT CHILDREN */
  const sortTree = (items: any[]) => {
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const item of items) {
      if (item.sub?.length) {
        sortTree(item.sub);
      }
    }
  };

  sortTree(tree);

  return tree;
}
