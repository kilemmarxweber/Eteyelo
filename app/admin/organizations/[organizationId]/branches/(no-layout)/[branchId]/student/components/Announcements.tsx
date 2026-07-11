import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const Announcements = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.user?.id;
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;

  if (!userId || !branchId || !organizationId) return null;

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      member: {
        userId,
        organizationId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  const canReadAll = canManageOrganization(session, branchMember?.role);

  let classIds: string[] = [];

  if (!canReadAll && branchMember) {
    if (hasSessionRole(session, [ORG_ROLE.STUDENT, "STUDENT"], branchMember.role)) {
      const enrollments = await prisma.classEnrollment.findMany({
        where: {
          branchId,
          student: {
            branchMemberId: branchMember.id,
          },
        },
        select: { classeId: true },
      });

      classIds = enrollments.map((enrollment) => enrollment.classeId);
    } else if (hasSessionRole(session, [ORG_ROLE.PARENT, "PARENT"], branchMember.role)) {
      const enrollments = await prisma.classEnrollment.findMany({
        where: {
          branchId,
          student: {
            parent: {
              branchMemberId: branchMember.id,
            },
          },
        },
        select: { classeId: true },
      });

      classIds = enrollments.map((enrollment) => enrollment.classeId);
    } else if (hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"], branchMember.role)) {
      const teachings = await prisma.teaching.findMany({
        where: {
          branchId,
          teacher: {
            branchMemberId: branchMember.id,
          },
        },
        select: { classeId: true },
      });

      classIds = teachings.map((teaching) => teaching.classeId);
    }
  }

  const events = await prisma.calendarEvent.findMany({
    take: 3,
    orderBy: { dateStart: "desc" },
    where: canReadAll
      ? { branchId, isArchived: false }
      : {
          branchId,
          isArchived: false,
          OR: [
            { classeId: null },
            ...(classIds.length > 0 ? [{ classeId: { in: classIds } }] : []),
          ],
        },
    include: {
      classe: {
        select: {
          nameClasse: true,
        },
      },
    },
  });

  return (
    <div className="rounded-md bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Announcements</h1>
        <span className="text-xs text-muted-foreground">View All</span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {events.length ? (
          events.map((event, index) => {
            const bgColor =
              index === 0
                ? "bg-sky-50"
                : index === 1
                  ? "bg-violet-50"
                  : "bg-amber-50";

            return (
              <div key={event.id} className={`${bgColor} rounded-md p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-medium">
                      {event.title || "Annonce"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {event.classe?.nameClasse || "Toutes les classes"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("fr-FR").format(event.dateStart)}
                  </span>
                </div>

                {event.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {event.description}
                  </p>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
            Aucune annonce disponible.
          </div>
        )}
      </div>
    </div>
  );
};

export default Announcements;
