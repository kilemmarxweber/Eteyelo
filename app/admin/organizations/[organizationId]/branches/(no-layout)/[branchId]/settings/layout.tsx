"use client";

import { usePathname } from "next/navigation";
import {
  IconHeadphones,
  IconPalette,
  IconReportMoney,
  IconSettings,
  IconCalendarCog,
  IconUserCheck,
} from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import SidebarNav from "./components/sidebar-nav";

export default function Settings({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const branchBasePath =
    pathname?.match(/^\/admin\/organizations\/[^/]+\/branches\/[^/]+/)?.[0] ??
    "/admin";
  const settingsBasePath = `${branchBasePath}/settings`;

  const sidebarNavItems = [
    {
      title: "Compte",
      icon: <IconSettings size={18} />,
      href: `${settingsBasePath}/account`,
      permission: null,
    },
    {
      title: "Apparence",
      icon: <IconPalette size={18} />,
      href: `${settingsBasePath}/appearance`,
      permission: null,
    },
    {
      title: "Types de frais",
      icon: <IconReportMoney size={18} />,
      href: `${settingsBasePath}/typeFrais`,
      permission: null,
    },
    {
      title: "Calendrier scolaire",
      icon: <IconCalendarCog size={18} />,
      href: `${settingsBasePath}/calendar`,
      permission: null,
    },
    {
      title: "Présences",
      icon: <IconUserCheck size={18} />,
      href: `${settingsBasePath}/attendance`,
      permission: null,
    },
    {
      title: "Support de l'établissement",
      icon: <IconHeadphones size={18} />,
      href: `${settingsBasePath}/support`,
      permission: null,
    },
  ];

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
