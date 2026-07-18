"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AttendanceSettingsRedirectPage() {
  const router = useRouter();
  const params = useParams<{ organizationId: string; branchId: string }>();

  useEffect(() => {
    router.replace(
      `/admin/organizations/${params.organizationId}/branches/${params.branchId}/attendance/parametres`,
    );
  }, [params.branchId, params.organizationId, router]);

  return null;
}
