"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { buttonVariants } from "@/components/custom/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();
  const router = useRouter();
  const [val, setVal] = useState(pathname ?? "/admin/settings");
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleSelect = (e: string) => {
    setVal(e);
    router.push(e);
    setIsSheetOpen(false);
  };

  const handleLinkClick = () => {
    setIsSheetOpen(false);
  };

  const currentItem = items.find((item) => item.href === pathname);

  return (
    <>
      {/* Mobile Navigation - Sheet */}
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
                <div className="flex items-center">
                  <span className="mr-2">{currentItem.icon}</span>
                  {currentItem.title}
                </div>
              ) : (
                "Navigation"
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px]">
            <div className="px-1 py-6">
              <h2 className="mb-6 text-lg font-semibold tracking-tight">
                Paramètres
              </h2>
              <nav className="flex flex-col space-y-2">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      pathname === item.href
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

      {/* Desktop Navigation */}
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
                pathname === item.href
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
