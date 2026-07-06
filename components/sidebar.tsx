"use client";
import { useEffect, useState } from "react";
import { IconChevronsLeft, IconMenu2, IconX } from "@tabler/icons-react";
import { Layout, LayoutHeader } from "./custom/layout";
import { Button } from "./custom/button";
import Nav from "./nav";
import { cn, getBranchImage } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { buildStaticSideLinks } from "@/lib/sidebar-menu";
import { getBranchNameAction } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/branche.action";
import { useTheme } from "next-themes";
import Image from "next/image";
import cmj from "@/public/cmj.jpg";
import { normalizeImageSrc } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sidebar({
  className,
  isCollapsed,
  setIsCollapsed,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Use SSR flag to set initial state
  const isSSR = typeof window === "undefined";
  const [navOpened, setNavOpened] = useState(false);
  const [isCollapsedState, setIsCollapsedState] = useState(
    isSSR ? true : false,
  );
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branchLogo, setBranchLogo] = useState<string | null>(null);
  const { data: session } = authClient.useSession();
  const [branchLoaded, setBranchLoaded] = useState(false);
  const links = buildStaticSideLinks(session, pathname);
  const branchId = pathname.match(
    /^\/admin\/organizations\/[^/]+\/branches\/([^/]+)/,
  )?.[1];

  /* Make body not scrollable when navBar is opened */
  useEffect(() => {
    if (!branchId) {
      setBranchName(null);
      setBranchLogo(null);
      setBranchLoaded(true);
      return;
    }

    let ignore = false;

    setBranchLoaded(false);

    getBranchNameAction(branchId)
      .then((branch) => {
        if (ignore) return;

        setBranchName(branch?.name ?? null);
        setBranchLogo(getBranchImage(branch?.image, "logo"));
        setBranchLoaded(true);
      })
      .catch(() => {
        if (ignore) return;

        setBranchName(null);
        setBranchLogo(null);
        setBranchLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setBranchName(null);
      setBranchLogo(null);
      return;
    }

    let ignore = false;

    getBranchNameAction(branchId)
      .then((branch) => {
        if (ignore) return;

        setBranchName(branch?.name ?? null);
        setBranchLogo(getBranchImage(branch?.image, "logo"));
      })
      .catch(() => {
        if (ignore) return;

        setBranchName(null);
        setBranchLogo(null);
      });

    return () => {
      ignore = true;
    };
  }, [branchId]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isBackButtonPage =
    /^\/admin\/student\/[^/]+$/.test(pathname) ||
    /^\/admin\/results\/[^/]+$/.test(pathname) ||
    /^\/admin\/ficheCentrales\/[^/]+$/.test(pathname);
  return (
    <aside
      className={cn(
        `fixed left-0 right-0 top-0 z-50 w-full border-r-2 border-r-muted transition-[width] md:bottom-0 md:right-auto md:h-svh ${
          isCollapsed ? "md:w-14" : "md:w-44"
        }`,
        className,
      )}
    >
      <Layout>
        {/* Header */}
        <LayoutHeader className="sticky top-0 justify-between px-4 py-3 shadow md:px-4">
          <div
            className={`flex min-w-0 flex-col items-center ${
              !isCollapsed ? "gap-1" : ""
            }`}
          >
            {
              <Image
                src={
                  branchLoaded && branchLogo
                    ? normalizeImageSrc(branchLogo)
                    : cmj
                }
                alt={branchName ?? "Logo établissement"}
                width={120}
                height={120}
                priority
                className={`object-contain transition-all duration-300 ${
                  isCollapsed ? "w-full" : "ml-2 w-11"
                }`}
              />
            }
            {branchName && !isCollapsed && (
              <span className="max-w-full truncate text-center text-xs font-medium text-muted-foreground">
                {branchName}
              </span>
            )}
          </div>

          {/* Toggle Button in mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Toggle Navigation"
            aria-controls="sidebar-menu"
            aria-expanded={navOpened}
            onClick={() => setNavOpened((prev) => !prev)}
          >
            {navOpened ? <IconX /> : <IconMenu2 />}
          </Button>
          {/* <ThemeToggle />
          <UserNav /> */}
        </LayoutHeader>

        {/* Navigation links */}
        <Nav
          id="sidebar-menu"
          className={`h-full flex-1 overflow-auto ${
            navOpened ? "max-h-screen" : "max-h-0 py-0 md:max-h-screen md:py-2 "
          }`}
          closeNav={() => setNavOpened(false)}
          isCollapsed={isCollapsed}
          links={links}
        />

        {/* Scrollbar width toggle button */}
        <Button
          onClick={() => {
            if (isBackButtonPage) {
              router.back();
              return;
            }

            setIsCollapsed((prev) => !prev);
          }}
          size="icon"
          variant="outline"
          className="absolute -right-5 top-1/2 hidden rounded-full md:inline-flex"
        >
          {isBackButtonPage ? (
            <IconChevronsLeft stroke={1.5} className="h-5 w-5" />
          ) : (
            <IconChevronsLeft
              stroke={1.5}
              className={`h-5 w-5 ${isCollapsed ? "rotate-180" : ""}`}
            />
          )}
        </Button>
      </Layout>
    </aside>
  );
}
