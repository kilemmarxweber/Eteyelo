"use client";

import { useSession } from "@/lib/auth-client";
import {
  getSchoolYearDisplayLabel,
  getSchoolYearDisplayLabelLower,
  getSchoolYearDisplayLabelPlural,
} from "@/lib/university-lmd";

export function useSchoolYearLabels(typebranchOverride?: unknown) {
  const { data: session } = useSession();
  const typebranch = typebranchOverride ?? session?.branch?.typebranch;

  return {
    typebranch,
    label: getSchoolYearDisplayLabel(typebranch),
    labelPlural: getSchoolYearDisplayLabelPlural(typebranch),
    labelLower: getSchoolYearDisplayLabelLower(typebranch),
  };
}
