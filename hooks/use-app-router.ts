"use client";

import { useCallback, useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";

import { startRouteLoader } from "@/lib/route-loader";

type AppRouter = ReturnType<typeof useNextRouter>;

/**
 * Router app : déclenche le RouteChangeLoader sur push/replace.
 * L’overlay n’écoute que s’il est monté (layout branche).
 */
export function useAppRouter(): AppRouter {
  const router = useNextRouter();

  const push = useCallback(
    (...args: Parameters<AppRouter["push"]>) => {
      startRouteLoader();
      return router.push(...args);
    },
    [router],
  );

  const replace = useCallback(
    (...args: Parameters<AppRouter["replace"]>) => {
      startRouteLoader();
      return router.replace(...args);
    },
    [router],
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
