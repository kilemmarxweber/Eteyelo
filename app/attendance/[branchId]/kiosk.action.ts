"use server";

import { runAttendanceKiosk } from "@/lib/auth/attendance-kiosk-context";
import type { AttendanceGeoCoords } from "@/lib/attendance-geo";
import {
  checkInByScanAction,
  checkInPersonByIdAction,
  enrollFaceDescriptorAction,
  findOpenCheckoutForPersonAction,
  getQuickCheckInBootstrapAction,
  getLiveCheckInStatesAction,
  listPersonnelForCheckInAction,
  listStudentsForClassCheckInAction,
  matchFaceDescriptorAction,
  searchPeopleForCheckInAction,
  searchPeopleForFaceEnrollAction,
} from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/attendance/attendance-scan.action";
import {
  getAttendanceReportContextAction,
  getPersonnelRosterReportAction,
  getStudentRosterReportAction,
  getTeacherSessionReportAction,
  type PersonRosterReport,
  type TeacherSessionReport,
  recordNormalCheckoutAction,
  recordPersonnelEarlyExitAction,
  recordStudentEarlyExitAction,
  recordTeacherEarlyExitAction,
} from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/attendance/attendance-exit.action";
import type { AttendancePersonType } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/attendance/attendance-scan-types";
import type { AttendanceExitReason } from "@/prisma/generated/prisma/client";
import type { SchoolReportContext } from "@/lib/reports/types";

export async function kioskGetQuickCheckInBootstrapAction(branchId: string) {
  return runAttendanceKiosk(branchId, () => getQuickCheckInBootstrapAction());
}

export async function kioskGetLiveCheckInStatesAction(branchId: string) {
  return runAttendanceKiosk(branchId, () => getLiveCheckInStatesAction());
}

export async function kioskSearchPeopleForCheckInAction(
  branchId: string,
  query: string,
) {
  return runAttendanceKiosk(branchId, () => searchPeopleForCheckInAction(query));
}

export async function kioskSearchPeopleForFaceEnrollAction(
  branchId: string,
  query: string,
) {
  return runAttendanceKiosk(branchId, () =>
    searchPeopleForFaceEnrollAction(query),
  );
}

export async function kioskListStudentsForClassCheckInAction(
  branchId: string,
  classeId: string,
) {
  return runAttendanceKiosk(branchId, () =>
    listStudentsForClassCheckInAction(classeId),
  );
}

export async function kioskListPersonnelForCheckInAction(branchId: string) {
  return runAttendanceKiosk(branchId, () => listPersonnelForCheckInAction());
}

export async function kioskCheckInByScanAction(
  branchId: string,
  code: string,
  coords: AttendanceGeoCoords,
) {
  return runAttendanceKiosk(branchId, () => checkInByScanAction(code, coords));
}

export async function kioskCheckInPersonByIdAction(
  branchId: string,
  personType: AttendancePersonType,
  personId: string,
  coords: AttendanceGeoCoords,
) {
  return runAttendanceKiosk(branchId, () =>
    checkInPersonByIdAction(personType, personId, coords),
  );
}

export async function kioskFindOpenCheckoutForPersonAction(
  branchId: string,
  personType: AttendancePersonType,
  personId: string,
) {
  return runAttendanceKiosk(branchId, () =>
    findOpenCheckoutForPersonAction(personType, personId),
  );
}

export async function kioskMatchFaceDescriptorAction(
  branchId: string,
  descriptor: number[],
) {
  return runAttendanceKiosk(branchId, () =>
    matchFaceDescriptorAction(descriptor),
  );
}

export async function kioskEnrollFaceDescriptorAction(
  branchId: string,
  input: {
    personType: AttendancePersonType;
    personId: string;
    descriptor: number[];
  },
) {
  return runAttendanceKiosk(branchId, () => enrollFaceDescriptorAction(input));
}

export async function kioskRecordNormalCheckoutAction(
  branchId: string,
  input: { personType: AttendancePersonType; attendanceId: string },
) {
  return runAttendanceKiosk(branchId, () =>
    Promise.resolve(recordNormalCheckoutAction(input)),
  );
}

type EarlyExitInput = {
  attendanceId: string;
  reasonCode: AttendanceExitReason;
  reasonNote?: string;
};

export async function kioskRecordStudentEarlyExitAction(
  branchId: string,
  input: EarlyExitInput,
) {
  return runAttendanceKiosk(branchId, () =>
    Promise.resolve(recordStudentEarlyExitAction(input)),
  );
}

export async function kioskRecordTeacherEarlyExitAction(
  branchId: string,
  input: EarlyExitInput,
) {
  return runAttendanceKiosk(branchId, () =>
    Promise.resolve(recordTeacherEarlyExitAction(input)),
  );
}

export async function kioskRecordPersonnelEarlyExitAction(
  branchId: string,
  input: EarlyExitInput,
) {
  return runAttendanceKiosk(branchId, () =>
    Promise.resolve(recordPersonnelEarlyExitAction(input)),
  );
}

function unwrapZsaResult<T>(result: unknown, fallback: string): T {
  const [data, error] = result as [T | null, { message?: string } | null];
  if (error || !data) {
    throw new Error(error?.message || fallback);
  }
  return data;
}

export async function kioskGetAttendanceReportContextAction(branchId: string) {
  return runAttendanceKiosk(branchId, async () =>
    unwrapZsaResult<SchoolReportContext>(
      await getAttendanceReportContextAction(),
      "Contexte PDF introuvable.",
    ),
  );
}

export async function kioskGetTeacherSessionReportAction(
  branchId: string,
  input: {
    startDate: Date;
    endDate: Date;
    teacherId?: string | null;
    classeId?: string | null;
  },
) {
  return runAttendanceKiosk(branchId, async () =>
    unwrapZsaResult<TeacherSessionReport>(
      await getTeacherSessionReportAction(input),
      "Rapport enseignants introuvable.",
    ),
  );
}

export async function kioskGetStudentRosterReportAction(
  branchId: string,
  input: { startDate: Date; endDate: Date; classeId?: string | null },
) {
  return runAttendanceKiosk(branchId, async () =>
    unwrapZsaResult<PersonRosterReport>(
      await getStudentRosterReportAction(input),
      "Rapport élèves introuvable.",
    ),
  );
}

export async function kioskGetPersonnelRosterReportAction(
  branchId: string,
  input: { startDate: Date; endDate: Date },
) {
  return runAttendanceKiosk(branchId, async () =>
    unwrapZsaResult<PersonRosterReport>(
      await getPersonnelRosterReportAction(input),
      "Rapport personnel introuvable.",
    ),
  );
}
