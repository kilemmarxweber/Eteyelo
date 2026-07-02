import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";
import HomePageClient, { type HomeBranch } from "./home-page-client";
import { type StudentRanking } from "./components/sectionResult";

export const dynamic = "force-dynamic";

const branchImages = [
  "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1200&q=80",
];

async function getActiveBranches(): Promise<HomeBranch[]> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      image: true,
      adresse: true,
      ville: true,
      pays: true,
      latitude: true,
      longitude: true,
      organization: {
        select: {
          name: true,
        },
      },
      branchemembers: {
        select: {
          _count: {
            select: {
              student: true,
            },
          },
        },
      },
    },
  });

  return branches.map((branch, index) => {
    const studentsCount = branch.branchemembers.reduce(
      (total, member) => total + member._count.student,
      0,
    );

    return {
      id: branch.id,
      name: branch.name,
      city: branch.ville || branch.pays || branch.code || "RDC",
      address:
        branch.adresse ||
        [branch.ville, branch.pays].filter(Boolean).join(", ") ||
        `${branch.latitude.toFixed(4)}, ${branch.longitude.toFixed(4)}`,
      type: "Etablissement actif",
      image:
        normalizeImageSrc(branch.image) || branchImages[index % branchImages.length],
      studentsCount,
      organizationName: branch.organization.name,
    };
  });
}

async function getPartnaires() {
  const partnaires = await prisma.partnaire.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      id: true,
      name: true,
      image: true,
      website: true,
      slug: true,
      type: true,
      ville: true,
      pays: true,
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return partnaires.map((partnaire) => ({
    id: partnaire.id,
    name: partnaire.name,
    image: normalizeImageSrc(partnaire.image),
    href:
      partnaire.website ||
      `/contact?partnaire=${encodeURIComponent(partnaire.slug || partnaire.name)}`,
    type: partnaire.type || "Partenaire officiel",
    location: [partnaire.ville, partnaire.pays].filter(Boolean).join(", "),
    branchName: partnaire.branch?.name || null,
  }));
}

async function getStudentRankings(): Promise<StudentRanking[]> {
  const grades = await prisma.studentGrade.findMany({
    where: {
      branch: {
        isActive: true,
      },
    },
    orderBy: {
      score: "desc",
    },
    take: 30,
    select: {
      id: true,
      score: true,
      branch: {
        select: {
          name: true,
        },
      },
      student: {
        select: {
          classEnrollment: {
            orderBy: {
              updatedAt: "desc",
            },
            take: 1,
            select: {
              classe: {
                select: {
                  nameClasse: true,
                },
              },
            },
          },
          branchMember: {
            select: {
              member: {
                select: {
                  user: {
                    select: {
                      name: true,
                      prenom: true,
                      postnom: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return grades.map((grade) => {
    const user = grade.student.branchMember.member.user;
    const name = [user.prenom, user.name, user.postnom]
      .filter(Boolean)
      .join(" ");

    return {
      id: grade.id,
      name: name || "Eleve",
      school: grade.branch.name,
      className:
        grade.student.classEnrollment[0]?.classe?.nameClasse ||
        "Classe non definie",
      score: Math.round(grade.score),
    };
  });
}

export default async function HomePage() {
  const [branches, rankings, partnaires] = await Promise.all([
    getActiveBranches(),
    getStudentRankings(),
    getPartnaires(),
  ]);

  return (
    <HomePageClient
      branches={branches}
      rankings={rankings}
      partnaires={partnaires}
    />
  );
}
