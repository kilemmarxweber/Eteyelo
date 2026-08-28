"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/custom/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: React.ReactElement;
  }[];
}

export default function SidebarNav({
  className,
  items,
  ...props
}: SidebarNavProps) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleLinkClick = () => {
    setIsSheetOpen(false);
  };

  const isItemActive = (href: string) => {
    if (!hasMounted) return false;
    if (pathname === href) return true;
    // Ne pas activer « Profil » (/settings) pour toutes les sous-pages.
    if (href.endsWith("/settings")) return false;
    return pathname.startsWith(`${href}/`);
  };

  // Évite le mismatch SSR/client (session / pathname peuvent différer au premier paint).
  const currentItem = hasMounted
    ? [...items]
        .filter((item) => isItemActive(item.href))
        .sort((a, b) => b.href.length - a.href.length)[0]
    : undefined;

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
            >
              <Menu className="mr-2 h-4 w-4" />
              {currentItem ? (
                <span className="flex items-center">
                  <span className="mr-2">{currentItem.icon}</span>
                  {currentItem.title}
                </span>
              ) : (
                t("navigation")
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px]">
            <div className="px-1 py-6">
              <h2 className="mb-6 text-lg font-semibold tracking-tight">
                {t("title")}
              </h2>
              <nav className="flex flex-col space-y-2">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      isItemActive(item.href)
                        ? "bg-muted hover:bg-muted"
                        : "hover:bg-transparent hover:underline",
                      "justify-start",
                    )}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.title}
                  </Link>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden w-full overflow-x-auto bg-background px-1 py-2 lg:block">
        <nav
          className={cn(
            "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
            className,
          )}
          {...props}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                isItemActive(item.href)
                  ? "bg-muted hover:bg-muted"
                  : "hover:bg-transparent hover:underline",
                "justify-start",
              )}
            >
              <span className="mr-2">{item.icon}</span>
              {item.title}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
