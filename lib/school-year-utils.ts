import type { ISchoolYear } from "@/src/interfaces/SchoolYear";

export function findCurrentSchoolYear<
  T extends Pick<ISchoolYear, "isCurrentYear">,
>(schoolYears: T[]) {
  return schoolYears.find((schoolYear) => schoolYear.isCurrentYear);
}

export function getCurrentSchoolYearName<T extends Pick<ISchoolYear, "isCurrentYear" | "nameYear">>(
  schoolYears: T[],
) {
  return findCurrentSchoolYear(schoolYears)?.nameYear;
}
