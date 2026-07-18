export type StaffBadgeKind = "teacher" | "personnel";

export type StaffBadgeData = {
  kind: StaffBadgeKind;
  entityId: string;
  userId: string;
  lastName: string;
  postName: string;
  firstName: string;
  fullName: string;
  img?: string | null;
  matricule: string;
  roleLabel: string;
  schoolName: string;
  branchId: string;
  organizationId: string;
  branchLogo?: string | null;
  displayId: string;
};

export function getStaffBadgeTitle(kind: StaffBadgeKind) {
  return kind === "teacher" ? "CARTE D'ENSEIGNANT" : "CARTE DU PERSONNEL";
}

export function buildStaffBadgeQrPayload(params: {
  kind: StaffBadgeKind;
  entityId: string;
  branchId: string;
  organizationId: string;
}) {
  return JSON.stringify({
    v: 1,
    type: params.kind === "teacher" ? "teacher-card" : "personnel-card",
    ...(params.kind === "teacher"
      ? { teacherId: params.entityId }
      : { personnelId: params.entityId }),
    branchId: params.branchId,
    organizationId: params.organizationId,
  });
}

export function buildStaffDisplayCode(
  kind: StaffBadgeKind,
  entityId: string,
  branchId: string,
) {
  const slug = `${entityId.slice(-6)}-${branchId.slice(-4)}`.toUpperCase();
  return kind === "teacher" ? `ENS-${slug}` : `PRS-${slug}`;
}
