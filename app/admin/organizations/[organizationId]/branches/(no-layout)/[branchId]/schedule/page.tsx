import { Suspense } from "react";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  enforceScheduleAreaAccess,
  isCursusSelfScopedRole,
  listAccessibleCursusStudents,
  resolveScopedCursusStudent,
} from "@/lib/auth/cursus-scope";
import { getPeopleLabels } from "@/lib/people-labels";
import { buildStudentScheduleData } from "@/lib/student-schedule";
import CursusScheduleReadClient from "./CursusScheduleReadClient";

export const dynamic = "force-dynamic";

export default async function ScheduleIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { session, userId, branchId, organizationId, typebranch } =
    await requireBranchContext();
  const role = enforceScheduleAreaAccess(session);
  const sp = await searchParams;

  if (!isCursusSelfScopedRole(role)) {
    return (
      <div className="flex flex-col gap-2 text-muted-foreground">
        <p className="text-sm">
          Sélectionnez une classe dans le panneau de gauche pour planifier
          l&apos;horaire.
        </p>
      </div>
    );
  }

  const children = await listAccessibleCursusStudents({
    role,
    userId,
    branchId,
  });
  const scoped = await resolveScopedCursusStudent({
    role,
    userId,
    branchId,
    requestedStudentId: sp.studentId,
  });
  const peopleLabels = getPeopleLabels(typebranch);
  const schedule = await buildStudentScheduleData(
    scoped.classId,
    branchId,
    organizationId,
  );

  return (
    <Suspense fallback={null}>
      <CursusScheduleReadClient
        role={role}
        studentLabel={peopleLabels.student}
        childrenOptions={children}
        selectedStudent={scoped}
        schedule={schedule}
        notesHref={`/admin/organizations/${organizationId}/branches/${branchId}/notes`}
      />
    </Suspense>
  );
}
