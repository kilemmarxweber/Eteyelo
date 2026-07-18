"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";

import { getBranchTypeAction } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/classe/classe.action";
import { getBranchRouteRedirect } from "@/lib/branch-route-guard";

type UseBranchRouteGuardOptions = {
  routeSuffix: string;
};

export function useBranchRouteGuard({ routeSuffix }: UseBranchRouteGuardOptions) {
  const router = useRouter();
  const params = useParams<{
    organizationId: string;
    branchId: string;
  }>();

  useEffect(() => {
    let ignore = false;

    getBranchTypeAction()
      .then(([result, err]) => {
        if (ignore || err || !result?.typebranch) return;

        const redirectPath = getBranchRouteRedirect(
          routeSuffix,
          result.typebranch,
          params.organizationId,
          params.branchId,
        );

        if (redirectPath) {
          router.replace(redirectPath);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [params.branchId, params.organizationId, routeSuffix, router]);
}
