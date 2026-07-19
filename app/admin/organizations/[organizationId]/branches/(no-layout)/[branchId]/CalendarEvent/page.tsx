"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Ancienne URL — redirige vers Settings > Calendrier scolaire. */
export default function CalendarEventRedirectPage() {
  const router = useRouter();
  const params = useParams<{ organizationId: string; branchId: string }>();

  useEffect(() => {
    router.replace(
      `/admin/organizations/${params.organizationId}/branches/${params.branchId}/settings/calendar`,
    );
  }, [params.branchId, params.organizationId, router]);

  return null;
}
