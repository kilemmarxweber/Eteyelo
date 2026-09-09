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
  recordNormalCheckoutAction,
  recordPersonnelEarlyExitAction,
  recordStudentEarlyExitAction,
  recordTeacherEarlyExitAction,
} from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/attendance/attendance-exit.action";
import type { AttendancePersonType } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/attendance/attendance-scan-types";
import type { AttendanceExitReason } from "@/prisma/generated/prisma/client";

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
