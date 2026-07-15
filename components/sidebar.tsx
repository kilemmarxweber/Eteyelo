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
    <aside
      className={cn(
        "fixed left-0 right-0 top-0 z-50 w-full border-r-2 border-r-muted bg-background md:bottom-0 md:right-auto md:h-svh",
        isCollapsed ? "md:w-14" : "md:w-44",
        className,
      )}
    >
      <Layout className="h-full">
        <LayoutHeader className="sticky top-0 z-10 justify-between bg-background px-4 py-3 shadow md:px-4">
          <div
            className={cn(
              "flex min-w-0 flex-col items-center",
              !isCollapsed && "gap-1",
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
                isCollapsed ? "w-full" : "ml-2 w-11",
              )}
            />
            {branchName && !isCollapsed && (
              <span className="max-w-full truncate text-center text-xs font-medium text-muted-foreground">
                {branchName}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={navOpened ? "Fermer le menu" : "Ouvrir le menu"}
            aria-controls="sidebar-menu"
            aria-expanded={navOpened}
            onClick={() => setNavOpened((prev) => !prev)}
          >
            {navOpened ? <IconX /> : <IconMenu2 />}
          </Button>
        </LayoutHeader>

        <div
          id="sidebar-menu"
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            navOpened
              ? "max-h-[calc(100dvh-4.5rem)]"
              : "max-h-0 md:max-h-none",
          )}
        >
          <Nav
            className={cn(
              "min-h-0 flex-1 overflow-y-auto border-b md:border-none",
              !navOpened && "hidden md:block",
            )}
            closeNav={() => setNavOpened(false)}
            isCollapsed={isCollapsed}
            links={links}
            mobileNavOpen={navOpened}
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
  );
}
