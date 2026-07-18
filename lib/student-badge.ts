export type StudentBadgeData = {
  studentId: string;
  userId: string;
  lastName: string;
  postName: string;
  firstName: string;
  fullName: string;
  img?: string | null;
  sexe?: string | null;
  dateOfBirth?: Date | string | null;
  placeOfBirth?: string | null;
  nationality?: string | null;
  matricule: string;
  className: string;
  schoolName: string;
  yearCode: string;
  yearId: string;
  branchId: string;
  organizationId: string;
  organizationName?: string;
  organizationLogo?: string | null;
  branchLogo?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  qrCode: string;
  displayId: string;
};

export function buildStudentBadgeQrPayload(params: {
  studentId: string;
  yearId: string;
  branchId: string;
  organizationId: string;
}) {
  return JSON.stringify({
    v: 1,
    type: "student-card",
    studentId: params.studentId,
    yearId: params.yearId,
    branchId: params.branchId,
    organizationId: params.organizationId,
  });
}

export function buildStudentBadgeQrCode(
  studentId: string,
  yearId: string,
  branchId: string,
) {
  const slug = `${studentId.slice(-6)}-${yearId.slice(-4)}`.toUpperCase();
  return `ELV-${slug}`;
}

export function getStudentBadgeQrValue(badge: StudentBadgeData) {
  return buildStudentBadgeQrPayload({
    studentId: badge.studentId,
    yearId: badge.yearId,
    branchId: badge.branchId,
    organizationId: badge.organizationId,
  });
}

export function formatStudentBadgeDate(value?: Date | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR").format(date);
}
