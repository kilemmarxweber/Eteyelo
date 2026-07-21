"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  IconHeadphones,
  IconPalette,
  IconReportMoney,
  IconSettings,
  IconCalendarCog,
  IconUserCheck,
  IconBooks,
  IconClockHour4,
} from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { authClient } from "@/lib/auth-client";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import SidebarNav from "./components/sidebar-nav";

export default function Settings({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const canSeeOrgSettings = canAccessBranchOrgSettings(session);

  const branchBasePath =
    pathname?.match(/^\/admin\/organizations\/[^/]+\/branches\/[^/]+/)?.[0] ??
    "/admin";
  const settingsBasePath = `${branchBasePath}/settings`;

  const sidebarNavItems = useMemo(() => {
    const items = [
      {
        title: "Compte",
        icon: <IconSettings size={18} />,
        href: `${settingsBasePath}/account`,
        orgSettingsOnly: false,
      },
      {
        title: "Apparence",
        icon: <IconPalette size={18} />,
        href: `${settingsBasePath}/appearance`,
        orgSettingsOnly: false,
      },
      {
        title: "Types de frais",
        icon: <IconReportMoney size={18} />,
        href: `${settingsBasePath}/typeFrais`,
        orgSettingsOnly: true,
      },
      {
        title: "Calendrier scolaire",
        icon: <IconCalendarCog size={18} />,
        href: `${settingsBasePath}/calendar`,
        orgSettingsOnly: true,
      },
      {
        title: "Horaires",
        icon: <IconClockHour4 size={18} />,
        href: `${settingsBasePath}/horaires`,
        orgSettingsOnly: true,
      },
      {
        title: "Présences",
        icon: <IconUserCheck size={18} />,
        href: `${settingsBasePath}/attendance`,
        orgSettingsOnly: true,
      },
      {
        title: "Domaines primaire",
        icon: <IconBooks size={18} />,
        href: `${settingsBasePath}/primary-domains`,
        orgSettingsOnly: true,
      },
      {
        title: "Support de l'établissement",
        icon: <IconHeadphones size={18} />,
        href: `${settingsBasePath}/support`,
        orgSettingsOnly: true,
      },
    ];

    return items
      .filter((item) => !item.orgSettingsOnly || canSeeOrgSettings)
      .map(({ orgSettingsOnly: _, ...item }) => item);
  }, [settingsBasePath, canSeeOrgSettings]);

  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col" fixedHeight>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Parametres
          </h1>
          <p className="text-muted-foreground">
            Gerer les preferences de votre compte
          </p>
        </div>

        <div className="flex flex-1 flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 min-h-0">
          <aside className="lg:w-1/5">
            <SidebarNav items={sidebarNavItems} />
          </aside>

          <div className="flex-1 space-y-6 overflow-hidden min-h-0">
            <div className="rounded-lg border bg-card p-6 h-full overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </LayoutBody>
    </Layout>
  );
}
