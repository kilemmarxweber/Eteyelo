import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Une seule résolution de session par requête RSC / Server Action.
 * Évite le waterfall customSession × N layouts / guards.
 */
export const getCachedSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});
