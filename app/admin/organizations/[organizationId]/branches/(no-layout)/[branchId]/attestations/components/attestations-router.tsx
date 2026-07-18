"use client";

import { isAtelierBranch, isUniversiteBranch } from "@/lib/branch-capabilities";
import { AttestationsClient } from "./attestations-client";
import { UniversityAttestationsClient } from "./university-attestations-client";

type AttestationsRouterProps = {
  typebranch: string;
};

export function AttestationsRouter({ typebranch }: AttestationsRouterProps) {
  if (isUniversiteBranch(typebranch)) {
    return <UniversityAttestationsClient />;
  }

  if (isAtelierBranch(typebranch)) {
    return <AttestationsClient />;
  }

  return null;
}
