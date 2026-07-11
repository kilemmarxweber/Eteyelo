"use client";

import { IconChevronDown, IconLayoutDashboard } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { buttonVariants } from "./custom/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { TooltipProvider } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import useCheckActiveNav from "@/src/hooks/use-check-active-nav";
import { SideLink } from "@/src/data/sidelinks";
import { iconMap } from "@/lib/menu-mapper";

function resolveIcon(icon: unknown) {
  if (!icon) return IconLayoutDashboard;
  if (typeof icon === "string") return iconMap[icon] ?? IconLayoutDashboard;
  return icon;
}

interface NavProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed: boolean;
  links: SideLink[];
  closeNav: () => void;
  mobileNavOpen?: boolean;
}

export default function Nav({
  links,
  isCollapsed,
  className,
  closeNav,
  mobileNavOpen = true,
}: NavProps) {
  const pathname = usePathname();
  const { checkActiveNav } = useCheckActiveNav();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const activeParentTitle = useMemo(() => {
    return (
      links.find((link) =>
        link.sub?.some((sub) => {
          const current = pathname.replace(/\/$/, "") || "/";
          const target = sub.href.replace(/\/$/, "") || "/";
          if (!target || target === "#") return false;
          if (current === target) return true;
          const branchRoot = target.match(
            /^\/admin\/organizations\/[^/]+\/branches\/[^/]+$/,
          )?.[0];
          if (branchRoot) return current === branchRoot;
          if (target === "/admin") return current === "/admin";
          return current.startsWith(`${target}/`);
        }),
      )?.title ?? null
    );
  }, [links, pathname]);

  useEffect(() => {
    setOpenMenu(activeParentTitle);
  }, [pathname, activeParentTitle]);

  useEffect(() => {
    if (!mobileNavOpen) {
      setOpenMenu(activeParentTitle);
    }
  }, [mobileNavOpen, activeParentTitle]);

  return (
    <div
      data-collapsed={isCollapsed}
      className={cn(
        "group overflow-x-hidden bg-background py-2 transition-all md:border-none",
        className,
      )}
    >
      <TooltipProvider delayDuration={0}>
        <nav
          className={cn(
            "grid gap-1 overflow-y-auto pr-1 md:max-h-[calc(100vh-4rem)]",
            isCollapsed && "items-center justify-center",
          )}
        >
          {links.map((link) => {
            const key = `${link.title}-${link.href}`;
            const Icon = resolveIcon(link.icon);
            const hasChildren = (link.sub?.length ?? 0) > 0;

            if (hasChildren) {
              return (
                <NavLinkDropdown
                  key={key}
                  title={link.title}
                  icon={Icon}
                  sub={link.sub}
                  closeNav={closeNav}
                  checkActiveNav={checkActiveNav}
                  openMenu={openMenu}
                  onOpenChange={setOpenMenu}
                  isCollapsed={isCollapsed}
                />
              );
            }

            return (
              <NavLink
                key={key}
                title={link.title}
                icon={Icon}
                href={link.href}
                closeNav={closeNav}
                isCollapsed={isCollapsed}
                isActive={checkActiveNav(link.href)}
              />
            );
          })}
        </nav>
      </TooltipProvider>
    </div>
  );
}

function NavLink({
  title,
  icon: Icon,
  label,
  href,
  closeNav,
  isCollapsed,
  isActive,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  label?: string;
  href: string;
  closeNav: () => void;
  isCollapsed: boolean;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        closeNav();
      }}
    >
      <div
        className={cn(
          buttonVariants({
            variant: isActive ? "secondary" : "ghost",
            size: "sm",
          }),
          "h-12 w-full justify-start px-3",
          isActive && "bg-accent text-accent-foreground hover:bg-accent/90",
          !isActive && "hover:bg-accent/50",
          isCollapsed && "justify-center px-2",
        )}
      >
        <Icon size={18} />
        {!isCollapsed && <span className="ml-2 truncate">{title}</span>}
        {!isCollapsed && label && (
          <div className="ml-auto rounded-lg bg-primary px-1 text-[0.625rem] text-primary-foreground">
            {label}
          </div>
        )}
      </div>
    </Link>
  );
}

function NavLinkDropdown({
  title,
  icon: Icon,
  sub,
  closeNav,
  checkActiveNav,
  openMenu,
  onOpenChange,
  isCollapsed,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  sub?: SideLink[];
  closeNav: () => void;
  checkActiveNav: (href: string) => boolean;
  openMenu: string | null;
  onOpenChange: (title: string | null) => void;
  isCollapsed: boolean;
}) {
  const isOpen = openMenu === title;
  const isChildActive = sub?.some((item) => checkActiveNav(item.href)) ?? false;

  if (isCollapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              buttonVariants({
                variant: isChildActive ? "secondary" : "ghost",
                size: "sm",
              }),
              "h-12 w-full justify-center px-2",
            )}
            aria-label={title}
          >
            <Icon size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-44">
          {sub?.map((sublink) => {
            const SubIcon = resolveIcon(sublink.icon);
            const isActive = checkActiveNav(sublink.href);

            return (
              <DropdownMenuItem key={sublink.title} asChild>
                <Link
                  href={sublink.href}
                  className={cn(
                    "flex w-full items-center gap-2",
                    isActive && "bg-accent text-accent-foreground",
                  )}
                  onClick={() => closeNav()}
                >
                  <SubIcon size={16} />
                  <span>{sublink.title}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen ? title : null)}
    >
      <CollapsibleTrigger
        type="button"
        className={cn(
          buttonVariants({
            variant: isOpen || isChildActive ? "secondary" : "ghost",
            size: "sm",
          }),
          "group h-12 w-full justify-start px-3",
        )}
      >
        <Icon size={18} />
        <span className="ml-2">{title}</span>
        <span
          className={cn(
            "ml-auto transition-transform",
            isOpen && "rotate-180",
          )}
        >
          <IconChevronDown stroke={1} />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul>
          {sub?.map((sublink) => {
            const SubIcon = resolveIcon(sublink.icon);
            const isActive = checkActiveNav(sublink.href);

            return (
              <li key={sublink.title} className="my-1 ml-8">
                <NavLink
                  title={sublink.title}
                  icon={SubIcon}
                  href={sublink.href}
                  closeNav={closeNav}
                  isCollapsed={false}
                  isActive={isActive}
                />
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
