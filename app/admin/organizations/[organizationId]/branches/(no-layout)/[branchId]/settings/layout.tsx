"use client";

import { useMemo, type ReactElement } from "react";
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
import { BranchStickyHeader } from "@/components/layout/branch-sticky-header";
import { authClient } from "@/lib/auth-client";
import { isPrimaryBranch } from "@/lib/branch-capabilities";
import {
  canAccessBranchOrgSettings,
  canAccessSchoolOpsSettings,
  canAccessSupportSettings,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import SidebarNav from "./components/sidebar-nav";

type SettingsNavAccess = "always" | "org" | "school_ops" | "support";

export default function Settings({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const canSeeOrgSettings = canAccessBranchOrgSettings(session);
  const canSeeSchoolOps = canAccessSchoolOpsSettings(session);
  const canSeeSupport = canAccessSupportSettings(session);
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
    if (isCursusSelfUser && !canSeeOrgSettings && !canSeeSchoolOps) {
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

    const items: Array<{
      title: string;
      icon: ReactElement;
      href: string;
      access: SettingsNavAccess;
      primaryOnly?: boolean;
    }> = [
      {
        title: "Profil",
        icon: <IconUser size={18} />,
        href: settingsBasePath,
        access: "always",
      },
      {
        title: "Apparence",
        icon: <IconPalette size={18} />,
        href: `${settingsBasePath}/appearance`,
        access: "always",
      },
      {
        title: "Mot de passe",
        icon: <IconKey size={18} />,
        href: "/auth/change-password",
        access: "always",
      },
      {
        title: "Types de frais",
        icon: <IconReportMoney size={18} />,
        href: `${settingsBasePath}/typeFrais`,
        access: "org",
      },
      {
        title: "Taux de change",
        icon: <IconCurrencyDollar size={18} />,
        href: `${settingsBasePath}/exchange-rates`,
        access: "org",
      },
      {
        title: "Communication publique",
        icon: <IconClipboardList size={18} />,
        href: `${settingsBasePath}/inscription-publique`,
        access: "school_ops",
      },
      {
        title: "Calendrier scolaire",
        icon: <IconCalendarCog size={18} />,
        href: `${settingsBasePath}/calendar`,
        access: "school_ops",
      },
      {
        title: "Horaires",
        icon: <IconClockHour4 size={18} />,
        href: `${settingsBasePath}/horaires`,
        access: "org",
      },
      {
        title: "Présences",
        icon: <IconUserCheck size={18} />,
        href: `${settingsBasePath}/attendance`,
        access: "org",
      },
      {
        title: "Domaines primaire",
        icon: <IconBooks size={18} />,
        href: `${settingsBasePath}/primary-domains`,
        access: "org",
        primaryOnly: true,
      },
      {
        title: "Support",
        icon: <IconHeadphones size={18} />,
        href: `${settingsBasePath}/support`,
        access: "support",
      },
    ];

    const canAccess = (access: SettingsNavAccess) => {
      switch (access) {
        case "always":
          return true;
        case "org":
          return canSeeOrgSettings;
        case "school_ops":
          return canSeeSchoolOps;
        case "support":
          return canSeeSupport;
        default:
          return false;
      }
    };

    return items
      .filter(
        (item) =>
          canAccess(item.access) &&
          (!item.primaryOnly || showPrimaryDomains),
      )
      .map(({ access: _, primaryOnly: __, ...item }) => item);
  }, [
    settingsBasePath,
    canSeeOrgSettings,
    canSeeSchoolOps,
    canSeeSupport,
    showPrimaryDomains,
    isCursusSelfUser,
  ]);

  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col gap-0 pt-0 md:pt-0" fixedHeight>
        <BranchStickyHeader
          title="Parametres"
          description="Gerer les preferences de votre compte"
        />

        <div className="flex min-h-0 flex-1 flex-col gap-8 pt-1 lg:flex-row lg:gap-12">
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
