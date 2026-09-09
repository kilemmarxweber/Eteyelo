import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { getSessionRoles } from "@/lib/auth/session-roles";

export const ATTENDANCE_OWNER_BLOCKED_MESSAGE =
  "Le propriétaire ne peut pas pointer.";

/** Owner / propriétaire exclus du pointage et des rapports. Admin reste. */
export function isAttendanceOwnerBlocked(params: {
  memberRole?: unknown;
  userRole?: unknown;
}): boolean {
  const roles = getSessionRoles({
    user: { role: params.userRole },
    member: { role: params.memberRole },
  });
  if (roles.has(APP_ROLE.ADMIN)) return false;
  return roles.has(ORG_ROLE.OWNER) || roles.has("proprietaire");
}

export function memberIsAttendanceOwner(
  member:
    | {
        role?: unknown;
        user?: { role?: unknown } | null;
      }
    | null
    | undefined,
): boolean {
  return isAttendanceOwnerBlocked({
    memberRole: member?.role,
    userRole: member?.user?.role,
  });
}
