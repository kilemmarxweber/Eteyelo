"use client";

import {
  IconLayoutDashboard,
  IconUsers,
  IconSchool,
  IconSettings,
  IconBook2,
  IconReportMoney,
  IconCalendarEvent,
  IconClock,
  IconTableOptions,
  IconUserPlus,
  IconUserPentagon,
  IconCalendarClock,
  IconComponents,
  IconChartBar,
  IconNotebook,
  IconFolder,
  IconFileDescription,
  IconChevronDown,
} from "@tabler/icons-react";

import { Button, buttonVariants } from "./custom/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

import { cn } from "@/lib/utils";
import Link from "next/link";
import useCheckActiveNav from "@/src/hooks/use-check-active-nav";
import { SideLink } from "@/src/data/sidelinks";
import { useEffect, useRef, useState } from "react";

/* ================= ICON MAP ================= */
const iconMap: Record<string, any> = {
  dashboard: IconLayoutDashboard,
  users: IconUsers,
  school: IconSchool,
  settings: IconSettings,
  book: IconBook2,
  money: IconReportMoney,
  calendar: IconCalendarEvent,
  clock: IconClock,
  table: IconTableOptions,
  userplus: IconUserPlus,
  userpentagon: IconUserPentagon,
  calendarclock: IconCalendarClock,
  components: IconComponents,
  chart: IconChartBar,
  notebook: IconNotebook,
  folder: IconFolder,
  file: IconFileDescription,
};

function normalizeIconKey(icon: string) {
  return icon.toLowerCase().trim().replace(/^icon/, "");
}

function resolveIcon(icon: any) {
  if (!icon) return IconLayoutDashboard;
  if (typeof icon === "string") {
    const key = normalizeIconKey(icon);
    return iconMap[key] ?? IconLayoutDashboard;
  }
  return icon;
}

/* ================= TYPES ================= */
interface NavProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed: boolean;
  links: SideLink[];
  closeNav: () => void;
}

/* ================= MAIN NAV ================= */
export default function Nav({
  links,
  isCollapsed,
  className,
  closeNav,
}: NavProps) {
  const { checkActiveNav } = useCheckActiveNav();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeSubLink, setActiveSubLink] = useState<string | null>(null);
  const menuTransitionTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (menuTransitionTimer.current) {
        window.clearTimeout(menuTransitionTimer.current);
      }
    };
  }, []);

  const switchMenu = (nextMenu: string | null) => {
    if (menuTransitionTimer.current) {
      window.clearTimeout(menuTransitionTimer.current);
    }

    if (nextMenu === null || nextMenu === openMenu) {
      setOpenMenu(null);
      setActiveSubLink(null);
      return;
    }

    setOpenMenu(null);
    setActiveSubLink(null);

    menuTransitionTimer.current = window.setTimeout(() => {
      setOpenMenu(nextMenu);
    }, 90);
  };

  const renderLink = ({ sub, ...rest }: any) => {
    const key = `${rest.title}-${rest.href}`;
    const Icon = resolveIcon(rest.icon);
    const hasChildren = (sub?.length ?? 0) > 0;
    const isDropdownParent = hasChildren;

    if (isDropdownParent) {
      return (
        <NavLinkDropdown
          {...rest}
          icon={Icon}
          sub={sub}
          key={key}
          closeNav={closeNav}
          checkActiveNav={checkActiveNav}
          openMenu={openMenu}
          setOpenMenu={switchMenu}
          activeSubLink={activeSubLink}
          setActiveSubLink={setActiveSubLink}
          isCollapsed={isCollapsed}
        />
      );
    }

    return (
      <NavLink
        {...rest}
        icon={Icon}
        key={key}
        closeNav={closeNav}
        checkActiveNav={checkActiveNav}
        isCollapsed={isCollapsed}
      />
    );
  };

  return (
    <div
      data-collapsed={isCollapsed}
      className={cn(
        "group border-b bg-background py-2 transition-all md:border-none overflow-x-hidden",
        className,
      )}
    >
      <TooltipProvider delayDuration={0}>
        <nav
          className={cn(
            "grid gap-1 overflow-y-auto max-h-[calc(100vh-4rem)] pr-1",
            isCollapsed && "items-center justify-center",
          )}
        >
          {links.map(renderLink)}
        </nav>
      </TooltipProvider>
    </div>
  );
}

/* ================= SIMPLE LINK ================= */
function NavLink({
  title,
  icon: Icon,
  label,
  href,
  closeNav,
  checkActiveNav,
  isCollapsed,
  isActive,
  onClick,
}: any) {
  return (
    <Link
      href={href}
      onClick={() => {
        onClick?.();
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

/* ================= COLLAPSIBLE MENU ================= */
function NavLinkDropdown({
  title,
  icon: Icon,
  sub,
  closeNav,
  checkActiveNav,
  openMenu,
  setOpenMenu,
  activeSubLink,
  setActiveSubLink,
  isCollapsed,
}: any) {
  const isOpen = openMenu === title;
  const isChildActive = sub?.some((s: any) => checkActiveNav(s.href));
  const activeChildHref =
    activeSubLink ?? sub?.find((item: any) => checkActiveNav(item.href))?.href;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChildActive) setOpenMenu(title);
  }, [isChildActive, title, setOpenMenu]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, setOpenMenu]);

  return (
    <div ref={containerRef}>
      <Collapsible
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setActiveSubLink(null);
            setOpenMenu(title);
            return;
          }

          setOpenMenu(null);
          setActiveSubLink(null);
        }}
      >
        <CollapsibleTrigger
          className={cn(
            buttonVariants({
              variant: isOpen || isChildActive ? "secondary" : "ghost",
              size: "sm",
            }),
            "group h-12 w-full justify-start px-3",
            isCollapsed && "justify-center px-2",
          )}
        >
          <Icon size={18} />

          {!isCollapsed && <span className="ml-2">{title}</span>}

          {!isCollapsed && (
            <span className="ml-auto transition group-data-[state=open]:rotate-180">
              <IconChevronDown stroke={1} />
            </span>
          )}
        </CollapsibleTrigger>

        {!isCollapsed && (
          <CollapsibleContent>
            <ul>
              {sub?.map((sublink: any) => {
                const SubIcon = resolveIcon(sublink.icon);

                return (
                  <li key={sublink.title} className="ml-8 my-1">
                    <NavLink
                      {...sublink}
                      icon={SubIcon}
                      closeNav={closeNav}
                      checkActiveNav={checkActiveNav}
                      isCollapsed={false}
                      isActive={activeChildHref === sublink.href}
                      onClick={() => setActiveSubLink(sublink.href)}
                    />
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
