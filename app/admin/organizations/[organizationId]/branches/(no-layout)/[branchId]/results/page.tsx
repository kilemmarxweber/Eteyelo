import { prisma } from "@/lib/prisma";
import { RecapRow, TypeFiche } from "@/lib/types";
import SidebarWithFilters from "./SidebarTotal";
import { notFound } from "next/navigation";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconChartBar } from "@tabler/icons-react";
import { ORG_ROLE } from "@/lib/permissions";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canAccessResultsArea,
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";

export const dynamic = "force-dynamic";

const ResultListPage = async () => {
  const { session, userId: currentUserId, branchId } =
    await requireBranchContext();
  if (!canAccessResultsArea(session)) {
    notFound();
  }

  const canManage = canManageOrganization(session);
  const role = canManage
    ? "admin"
    : hasSessionRole(session, [ORG_ROLE.STUDENT, "STUDENT"])
      ? "student"
      : hasSessionRole(session, [ORG_ROLE.PARENT, "PARENT"])
        ? "parent"
        : hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"])
          ? "teacher"
          : "guest";

  const student = await prisma.student.findFirst({
    where: {
      branchMember: {
        branchId,
        member: {
          userId: currentUserId,
        },
      },
    },
    include: {
      branchMember: {
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  let selectedStudentId = student?.id;
  let classData: any[] = [];

  // ================= STUDENT =================
  if (role === "student") {
    const studentAffectation = await prisma.classEnrollment.findFirst({
      where: {
        branchId,
        studentId: selectedStudentId,
        schoolYear: { isCurrentYear: true, branchId },
      },
      include: {
        classe: {
          include: {
            classEnrollment: {
              where: {
                branchId,
                schoolYear: { isCurrentYear: true, branchId },
              },
              include: {
                student: {
                  include: {
                    branchMember: {
                      include: {
                        member: {
                          include: {
                            user: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            teaching: {
              where: {
                OR: [
                  { branchId },
                  {
                    branchId: null,
                    classe: {
                      branchId,
                    },
                  },
                ],
              },
              include: {
                cours: true,
                fiche: true,
              },
            },
          },
        },
      },
    });

    if (studentAffectation) {
      classData = [studentAffectation.classe];
    }
  }

  // ================= ADMIN =================
  if (role === "admin") {
    classData = await prisma.classe.findMany({
      where: {
        branchId,
      },
      include: {
        classEnrollment: {
          where: {
            branchId,
            schoolYear: { isCurrentYear: true, branchId },
          },
          include: {
            student: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        teaching: {
          where: {
            OR: [
              { branchId },
              {
                branchId: null,
                classe: {
                  branchId,
                },
              },
            ],
          },
          include: {
            cours: true,
            fiche: true,
          },
        },
      },
    });
  }

  // ================= PARENT =================
  let parentStudents: any[] = [];
  if (role === "parent") {
    parentStudents = await prisma.student.findMany({
      where: {
        branchMember: {
          branchId,
        },
        parent: {
          branchMember: {
            branchId,
            member: {
              userId: currentUserId,
            },
          },
        },
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
        classEnrollment: {
          where: {
            branchId,
            schoolYear: { isCurrentYear: true, branchId },
          },
          include: {
            classe: {
              include: {
                classEnrollment: {
                  where: {
                    branchId,
                    schoolYear: { isCurrentYear: true, branchId },
                  },
                  include: {
                    student: {
                      include: {
                        branchMember: {
                          include: {
                            member: {
                              include: {
                                user: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                teaching: {
                  where: {
                    OR: [
                      { branchId },
                      {
                        branchId: null,
                        classe: {
                          branchId,
                        },
                      },
                    ],
                  },
                  include: {
                    cours: true,
                    fiche: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    classData = parentStudents.flatMap((s) =>
      s.classEnrollment.map((ce: { classe: any }) => ce.classe),
    );
  }

  if (role === "teacher") {
    const teachings = await prisma.teaching.findMany({
      where: {
        teacher: {
          branchMember: {
            branchId,
            member: {
              userId: currentUserId,
            },
          },
        },
        OR: [
          { branchId },
          {
            branchId: null,
            classe: {
              branchId,
            },
          },
        ],
      },
      include: {
        classe: {
          include: {
            classEnrollment: {
              where: {
                branchId,
                schoolYear: { isCurrentYear: true, branchId },
              },
              include: {
                student: {
                  include: {
                    branchMember: {
                      include: {
                        member: {
                          include: {
                            user: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            teaching: {
              where: {
                OR: [
                  { branchId },
                  {
                    branchId: null,
                    classe: {
                      branchId,
                    },
                  },
                ],
              },
              include: {
                cours: true,
                fiche: true,
              },
            },
          },
        },
      },
    });

    const classMap = new Map<string, any>();
    teachings.forEach((teaching) => {
      if (teaching.classe) {
        classMap.set(teaching.classe.id, teaching.classe);
      }
    });
    classData = Array.from(classMap.values());
  }

  // ================= FICHES =================
  const fiches = classData.flatMap((c) =>
    (c.teaching ?? []).flatMap((t: any) =>
      (t.fiche ?? [])
        .filter((f: any) => f.typeFiche === "ficheCote")
        .map((f: any) => ({
          ...f,
          subjectName: t.cours.nameCours ?? "N/A",
          classId: c.id,
        })),
    ),
  );
  // ================= MAP =================
  const map = new Map<string, RecapRow>();
  const parentStudentIds = new Set(parentStudents.map((ps) => ps.id));
  const students = classData.flatMap((c) =>
    (c.classEnrollment ?? [])
      .filter((sa: any) =>
        role === "parent" ? parentStudentIds.has(sa.student.id) : true,
      )
      .map((sa: any) => ({
        studentUser: sa.student.branchMember?.member?.user,
        studentid: sa.student.id,
        nom: sa.student.branchMember?.member?.user?.name ?? "",
        surname: sa.student.branchMember?.member?.user?.postnom ?? "",
        username: sa.student.branchMember?.member?.user?.prenom ?? "",
        naissance:
          sa.student.branchMember?.member?.user?.dateOfBirth?.toISOString() ??
          "",
        sexe: sa.student.branchMember?.member?.user?.sexe ?? "",
        classid: c.id,
        classe: c.nameClasse,
      })),
  );

  students.forEach((s) => {
    map.set(s.studentid, {
      studentId: s.studentid,
      nom: s.nom,
      studentSurname: s.surname,
      studentusername: s.username,
      studentnaissance: s.naissance,
      studentSexe: s.sexe,
      studentclasse: s.classe,
      periods: [],
    });
  });
  // ================= INJECT NOTES =================
  fiches.forEach((fiche) => {
    let notesParsed = [];

    try {
      notesParsed = fiche.notes ? JSON.parse(fiche.notes) : [];
    } catch {
      notesParsed = [];
    }

    notesParsed.forEach((note: any, i: number) => {
      const student = map.get(note.studentId);
      if (!student) return;

      let period = student.periods.find(
        (p) =>
          p.periodName === fiche.periodeName && p.anneeName === fiche.anneeName,
      );

      if (!period) {
        period = {
          classId: fiche.classId,
          periodName: fiche.periodeName,
          anneeName: fiche.anneeName,
          notes: {},
          autres: {} as TypeFiche, // ✅ FIX
        };
        student.periods.push(period);
      }

      const key = `${fiche.subjectName}-${fiche.id}-${i}`;

      period.notes[key] = {
        periodName: fiche.periodeName, // ✅
        anneeName: fiche.anneeName, // ✅
        score: note.score ?? 0,
        maxScore: note.maxScore ?? 0,
      };
    });
  });

  // ================= RESULT DATA =================
  const resultData = Array.from(map.values()).flatMap((student) =>
    student.periods.flatMap((period) =>
      Object.entries(period.notes).map(([key, note]) => ({
        id: `${student.studentId}`,
        studentId: student.studentId, // 🔥 IMPORTANT
        name: key.split("-")[0],

        note: note.score,
        total: note.maxScore,

        classId: period.classId,
        periodName: period.periodName,
        yearName: period.anneeName,

        // 🔥 AJOUT IMPORTANT POUR UI
        TypeFiche: key.includes("ficheCote") ? "ficheCote" : undefined,
        Comment: "",
        sexe: student.studentSexe ?? "",
        status: note.score === 0 ? "En cours" : "",
      })),
    ),
  );

  // ================= CLASS OPTIONS =================
  const classOptions = classData.map((c) => ({
    id: c.id,
    name: c.codeClasse,
    capacity: 25,
    supervisor: "",
  }));

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des Resultats"
          description="Gérer les informations des Resultats des élèves"
          badge={
            <Badge variant="outline-primary" icon={<IconChartBar size={14} />}>
              Resultats
            </Badge>
          }
        />

        <Card
          variant="default"
          className="mt-0 border flex flex-col xl:flex-row gap-2 rounded-md shadow-sm"
        >
          <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">
            <SidebarWithFilters
              classOptions={classOptions}
              data={resultData}
              role={role}
              students={students}
            />
          </div>
        </Card>
      </LayoutBody>
    </Layout>
  );
};

export default ResultListPage;
