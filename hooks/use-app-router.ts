"use client";

import { useCallback, useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";

import { useAppLoading } from "@/hooks/use-app-loading";

type AppRouter = ReturnType<typeof useNextRouter>;

export function useAppRouter(): AppRouter {
  const router = useNextRouter();
  const { startNavigationLoading } = useAppLoading();

  const push = useCallback(
    (...args: Parameters<AppRouter["push"]>) => {
      startNavigationLoading();
      return router.push(...args);
    },
    [router, startNavigationLoading],
  );

  const replace = useCallback(
    (...args: Parameters<AppRouter["replace"]>) => {
      startNavigationLoading();
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
