"use client";

import { useEffect } from "react";

import { hideRouteLoader, startRouteLoader } from "@/lib/route-loader";

type BranchLoadingFallbackProps = {
  className?: string;
  label?: string;
};

/**
 * Ne rend plus de second spinner : le RouteChangeLoader global reste le seul loader.
 * Tant que ce composant est monté, on maintient l’overlay principal.
 */
export function BranchLoadingFallback(_props: BranchLoadingFallbackProps) {
  useEffect(() => {
    startRouteLoader();
    return () => hideRouteLoader();
  }, []);

  return null;
}

export default BranchLoadingFallback;
