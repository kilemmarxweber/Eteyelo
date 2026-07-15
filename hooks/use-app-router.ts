"use client";

import { useCallback, useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";

import { useAppLoading } from "@/hooks/use-app-loading";

type AppRouter = ReturnType<typeof useNextRouter>;

function hasDedicatedBranchLoader(href: string) {
  try {
    const pathname = href.startsWith("http")
      ? new URL(href).pathname
      : href.split("?")[0] ?? href;

    if (pathname.includes("/branches/enter/")) return true;

    const match = pathname.match(/\/branches\/([^/]+)(?:\/|$)/);
    if (!match) return false;

    const segment = match[1];
    return segment !== "new" && segment !== "edit" && segment !== "enter";
  } catch {
    return false;
  }
}

export function useAppRouter(): AppRouter {
  const router = useNextRouter();
  const { startNavigationLoading } = useAppLoading();

  const push = useCallback(
    (...args: Parameters<AppRouter["push"]>) => {
      const href = String(args[0] ?? "");
      if (!hasDedicatedBranchLoader(href)) {
        startNavigationLoading();
      }
      return router.push(...args);
    },
    [router, startNavigationLoading],
  );

  const replace = useCallback(
    (...args: Parameters<AppRouter["replace"]>) => {
      const href = String(args[0] ?? "");
      if (!hasDedicatedBranchLoader(href)) {
        startNavigationLoading();
      }
      return router.replace(...args);
    },
    [router, startNavigationLoading],
  );

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
    }),
    [router, push, replace],
  );
}
