"use client";

import { useEffect, useState } from "react";
import { IconChevronsLeft, IconMenu2, IconX } from "@tabler/icons-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";

import { Layout, LayoutHeader } from "./custom/layout";
import { Button } from "./custom/button";
import Nav from "./nav";
import { cn, getBranchImage, normalizeImageSrc } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { buildStaticSideLinks } from "@/lib/sidebar-menu";
import { getBranchNameAction } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/branche.action";
import { NotificationBell } from "@/components/notification-bell";
import { Search } from "@/components/search";
import { ThemeToggle } from "@/src/theme/ThemeToggle";
import cmj from "@/public/cmj.jpg";

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
  const [navOpened, setNavOpened] = useState(false);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branchLogo, setBranchLogo] = useState<string | null>(null);
  const [branchType, setBranchType] = useState<unknown>(undefined);
  const [branchLoaded, setBranchLoaded] = useState(false);
  const { data: session } = authClient.useSession();
  const links = buildStaticSideLinks(session, pathname, branchType);
  const branchId = pathname.match(
    /^\/admin\/organizations\/[^/]+\/branches\/([^/]+)/,
  )?.[1];

  useEffect(() => {
    if (!branchId) {
      setBranchName(null);
      setBranchLogo(null);
      setBranchType(undefined);
      setBranchLoaded(true);
      return;
    }

    let ignore = false;
    setBranchLoaded(false);

    getBranchNameAction(branchId)
      .then((branch) => {
        if (ignore) return;
        const images = getBranchImage(branch?.image);
        setBranchLogo(images.logo ?? null);
        setBranchName(branch?.name ?? null);
        setBranchType(branch?.typebranch);
        setBranchLoaded(true);
      })
      .catch(() => {
        if (ignore) return;
        setBranchName(null);
        setBranchLogo(null);
        setBranchType(undefined);
        setBranchLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, [branchId]);

  useEffect(() => {
    setNavOpened(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpened) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [navOpened]);

  const isBackButtonPage =
    /^\/admin\/student\/[^/]+$/.test(pathname) ||
    /^\/admin\/results\/[^/]+$/.test(pathname) ||
    /^\/admin\/ficheCentrales\/[^/]+$/.test(pathname);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden">
        <LayoutHeader className="min-h-16 items-center gap-1.5 px-2 py-2 sm:gap-2 sm:px-3">
          <div
            className={cn(
              "flex shrink-0 flex-col items-center",
              isCollapsed ? "w-full" : "w-[4.5rem]",
            )}
          >
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
              className="w-9 shrink-0 object-contain"
            />
            {branchName && !isCollapsed && (
              <span className="mt-0.5 line-clamp-2 w-full px-0.5 text-center text-[10px] font-medium leading-tight text-muted-foreground">
                {branchName}
              </span>
            )}
          </div>

          <Search className="min-w-0 flex-1" />

          <div className="flex shrink-0 items-center gap-0.5">
            <ThemeToggle />
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              aria-label={navOpened ? "Fermer le menu" : "Ouvrir le menu"}
              aria-controls="sidebar-menu"
              aria-expanded={navOpened}
              onClick={() => setNavOpened((prev) => !prev)}
            >
              {navOpened ? <IconX /> : <IconMenu2 />}
            </Button>
          </div>
        </LayoutHeader>
      </div>

      {navOpened ? (
        <div
          id="sidebar-menu"
          className="fixed inset-x-0 top-16 bottom-[76px] z-40 overflow-y-auto border-b bg-background md:hidden"
        >
          <Nav
            className="min-h-0 flex-1 overflow-y-auto border-b"
            closeNav={() => setNavOpened(false)}
            isCollapsed={isCollapsed}
            links={links}
            mobileNavOpen={navOpened}
          />
        </div>
      ) : null}

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-40 hidden border-r-2 border-r-muted bg-background md:block md:h-svh",
          isCollapsed ? "md:w-14" : "md:w-44",
          className,
        )}
      >
        <Layout className="h-full">
          <LayoutHeader className="sticky top-0 z-10 min-h-14 flex-col items-center gap-1 px-4 py-3 shadow">
            <div
              className={cn(
                "flex w-full flex-col items-center",
                isCollapsed ? "w-full" : "gap-1",
              )}
            >
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
                className={cn(
                  "object-contain transition-all duration-300",
                  isCollapsed ? "w-full" : "ml-2 w-11 shrink-0",
                )}
              />
              {branchName && !isCollapsed && (
                <span className="line-clamp-3 w-full px-1 text-center text-xs font-medium leading-tight text-muted-foreground">
                  {branchName}
                </span>
              )}
            </div>
          </LayoutHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Nav
              className="min-h-0 flex-1 overflow-y-auto border-b md:border-none"
              closeNav={() => setNavOpened(false)}
              isCollapsed={isCollapsed}
              links={links}
              mobileNavOpen={false}
            />
          </div>

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
                className={cn("h-5 w-5", isCollapsed && "rotate-180")}
              />
            )}
          </Button>
        </Layout>
      </aside>
    </>
  );
}
