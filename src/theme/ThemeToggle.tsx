'use client'
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import React from "react";
import {Moon, SunMedium} from 'lucide-react'

export const ThemeToggle = () => {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0"
      onClick={() => {
        if (resolvedTheme !== "dark" && resolvedTheme !== "light") return;
        const next = resolvedTheme === "dark" ? "light" : "dark";
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(next);
        root.style.colorScheme = next;
        setTheme(next);
      }}
    >
      <SunMedium
        size={20}
        className="rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0 "
      />
      <Moon
        size={20}
        className="rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 absolute"
      />
      <span className="sr-only">Toggle Theme</span>
    </Button>
  );
};
