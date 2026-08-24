"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
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
  IconCalendarEvent,
  IconSchool,
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
import { getBranchTypeAction } from "../classe/classe.action";
import SidebarNav from "./components/sidebar-nav";
import { useTranslations } from "next-intl";

type SettingsNavAccess = "always" | "org" | "school_ops" | "support";

export default function Settings({ children }: { children: React.ReactNode }) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const [branchType, setBranchType] = useState<string | null>(null);
  const sessionReady = hasMounted && !isPending;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let ignore = false;

    getBranchTypeAction()
      .then(([result, err]) => {
        if (ignore || err || !result?.typebranch) return;
        setBranchType(String(result.typebranch));
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [pathname]);

  const canSeeOrgSettings = sessionReady && canAccessBranchOrgSettings(session);
  const canSeeSchoolOps = sessionReady && canAccessSchoolOpsSettings(session);
  const canSeeSupport = sessionReady && canAccessSupportSettings(session);
  const resolvedBranchType =
    branchType ?? session?.branch?.typebranch ?? null;
  const showPrimaryDomains =
    sessionReady && isPrimaryBranch(resolvedBranchType);
  const isCursusSelfUser =
    sessionReady &&
    hasSessionRole(session, [
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
          title: t("profile"),
          icon: <IconUser size={18} />,
          href: settingsBasePath,
        },
        {
          title: t("password"),
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
        title: t("profile"),
        icon: <IconUser size={18} />,
        href: settingsBasePath,
        access: "always",
      },
      {
        title: t("appearance"),
        icon: <IconPalette size={18} />,
        href: `${settingsBasePath}/appearance`,
        access: "always",
      },
      {
        title: t("password"),
        icon: <IconKey size={18} />,
        href: "/auth/change-password",
        access: "always",
      },
      {
        title: t("feeTypes"),
        icon: <IconReportMoney size={18} />,
        href: `${settingsBasePath}/typeFrais`,
        access: "org",
      },
      {
        title: t("exchangeRates"),
        icon: <IconCurrencyDollar size={18} />,
        href: `${settingsBasePath}/exchange-rates`,
        access: "org",
      },
      {
        title: t("publicCommunication"),
        icon: <IconClipboardList size={18} />,
        href: `${settingsBasePath}/inscription-publique`,
        access: "school_ops",
      },
      {
        title: t("schoolCalendar"),
        icon: <IconCalendarCog size={18} />,
        href: `${settingsBasePath}/calendar`,
        access: "school_ops",
      },
      {
        title: t("schoolYear"),
        icon: <IconSchool size={18} />,
        href: `${settingsBasePath}/annee-scolaire`,
        access: "school_ops",
      },
      {
        title: t("periods"),
        icon: <IconCalendarEvent size={18} />,
        href: `${settingsBasePath}/periodes`,
        access: "school_ops",
      },
      {
        title: t("attendance"),
        icon: <IconUserCheck size={18} />,
        href: `${settingsBasePath}/attendance`,
        access: "org",
      },
      {
        title: t("primaryDomains"),
        icon: <IconBooks size={18} />,
        href: `${settingsBasePath}/primary-domains`,
        access: "school_ops",
        primaryOnly: true,
      },
      {
        title: t("support"),
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
    t,
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
          title={t("title")}
          description={t("description")}
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
