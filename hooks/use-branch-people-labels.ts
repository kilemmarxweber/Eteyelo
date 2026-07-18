"use client";

import { useSession } from "@/lib/auth-client";
import {
  DEFAULT_PEOPLE_LABELS,
  getPeopleLabels,
  type PeopleLabels,
} from "@/lib/people-labels";

/** Libellés élève / apprenant / étudiant selon le type de branche (session). */
export function useBranchPeopleLabels(typebranchOverride?: unknown): PeopleLabels {
  const { data: session } = useSession();
  const typebranch = typebranchOverride ?? session?.branch?.typebranch;

  if (!typebranch) {
    return DEFAULT_PEOPLE_LABELS;
  }

  return getPeopleLabels(typebranch);
}
