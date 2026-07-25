"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  IconClipboardList,
  IconHeadphones,
  IconKey,
  IconPalette,
  IconReportMoney,
  IconCalendarCog,
  IconBooks,
  IconUser,
  IconUserCheck,
  IconCurrencyDollar,
  IconClockHour4,
} from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { authClient } from "@/lib/auth-client";
import { isPrimaryBranch } from "@/lib/branch-capabilities";
import {
  canAccessBranchOrgSettings,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import SidebarNav from "./components/sidebar-nav";

export default function Settings({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const canSeeOrgSettings = canAccessBranchOrgSettings(session);
  const showPrimaryDomains = isPrimaryBranch(session?.branch?.typebranch);
  const isCursusSelfUser = hasSessionRole(session, [
    ORG_ROLE.STUDENT,
    "STUDENT",
    "student",
    ORG_ROLE.PARENT,
    "PARENT",
    "parent",
  ]);

  const branchBasePath =
    pathname?.match(/^\/admin\/organizations\/[^/]+\/branches\/[^/]+/)?.[0] ??
    "/admin";
  const settingsBasePath = `${branchBasePath}/settings`;

  const sidebarNavItems = useMemo(() => {
    // Élève / parent : profil + mot de passe uniquement (unit-05).
    if (isCursusSelfUser && !canSeeOrgSettings) {
      return [
        {
          title: "Profil",
          icon: <IconUser size={18} />,
          href: settingsBasePath,
        },
        {
          title: "Mot de passe",
          icon: <IconKey size={18} />,
          href: "/auth/change-password",
        },
      ];
    }

    const items = [
      {
        title: "Profil",
        icon: <IconUser size={18} />,
        href: settingsBasePath,
        orgSettingsOnly: false,
      },
      {
        title: "Apparence",
        icon: <IconPalette size={18} />,
        href: `${settingsBasePath}/appearance`,
        orgSettingsOnly: false,
      },
      {
        title: "Mot de passe",
        icon: <IconKey size={18} />,
        href: "/auth/change-password",
        orgSettingsOnly: false,
      },
      {
        title: "Types de frais",
        icon: <IconReportMoney size={18} />,
        href: `${settingsBasePath}/typeFrais`,
        orgSettingsOnly: true,
      },
      {
        title: "Taux de change",
        icon: <IconCurrencyDollar size={18} />,
        href: `${settingsBasePath}/exchange-rates`,
        orgSettingsOnly: true,
      },
      {
        title: "Communication publique",
        icon: <IconClipboardList size={18} />,
        href: `${settingsBasePath}/inscription-publique`,
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
        primaryOnly: true,
      },
      {
        title: "Support",
        icon: <IconHeadphones size={18} />,
        href: `${settingsBasePath}/support`,
        orgSettingsOnly: true,
      },
    ];

    return items
      .filter(
        (item) =>
          (!item.orgSettingsOnly || canSeeOrgSettings) &&
          (!("primaryOnly" in item && item.primaryOnly) || showPrimaryDomains),
      )
      .map(({ orgSettingsOnly: _, primaryOnly: __, ...item }) => item);
  }, [
    settingsBasePath,
    canSeeOrgSettings,
    showPrimaryDomains,
    isCursusSelfUser,
  ]);

  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col" fixedHeight>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Parametres
          </h1>
          <p className="text-muted-foreground">
            Gerer les preferences de votre compte
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row lg:gap-12">
          <aside className="lg:w-1/5">
            <SidebarNav items={sidebarNavItems} />
          </aside>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto rounded-lg border bg-card p-6">
              {children}
            </div>
          </div>
        </div>
      </LayoutBody>
    </Layout>
  );
}
