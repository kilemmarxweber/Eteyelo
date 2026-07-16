"use server";

import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";

const fallbackSchools = [
  {
    name: "CS La Fortune",
    city: "Lubumbashi",
    students: 1200,
    heroLabel: "Ecole partenaire verifiee",
    heroTitle: "CS La Fortune accompagne 1 200 eleves a Lubumbashi",
    image: KLAMBOCORE_DEFAULT_IMAGE_PATH,
  },
  {
    name: "Bakhita",
    city: "Cabinda",
    students: 850,
    heroLabel: "Institut actif a Cabinda",
    heroTitle: "Bakhita valorise ses filieres, evenements et resultats",
    image: KLAMBOCORE_DEFAULT_IMAGE_PATH,
  },
  {
    name: "Complexo Escolar Privado Padre Pitra",
    city: "Cabinda",
    students: 970,
    heroLabel: "Complexe scolaire partenaire",
    heroTitle: "Padre Pitra gagne en visibilite aupres des familles",
    image: KLAMBOCORE_DEFAULT_IMAGE_PATH,
  },
];

const fallbackEvents = [
  {
    title: "Journee portes ouvertes",
    school: "CS La Fortune",
    date: "12 Juin",
    image: KLAMBOCORE_DEFAULT_IMAGE_PATH,
  },
  {
    title: "Remise des diplomes",
    school: "Bakhita",
    date: "18 Juin",
    image: KLAMBOCORE_DEFAULT_IMAGE_PATH,
  },
  {
    title: "Concours scientifique",
    school: "Padre Pitra",
    date: "25 Juin",
    image: KLAMBOCORE_DEFAULT_IMAGE_PATH,
  },
];

const fallbackPartners = [
  "CS La Fortune",
  "Bakhita",
  "Padre Pitra",
  "Marguerite",
  "Institut Lumumba",
];

type HomeSchool = (typeof fallbackSchools)[number];
type HomeEvent = (typeof fallbackEvents)[number];

type NewSchool = {
  name: string;
  city: string;
  date: string;
};

type ResultSlide = {
  school: string;
  city: string;
  students: {
    studentid: string;
    name: string;
    percent: string;
    image: string;
  }[];
};

const fallbackNewSchools: NewSchool[] = [
  {
    name: "Groupe Scolaire Sainte Marie",
    city: "Kinshasa",
    date: "Inscrite recemment",
  },
  {
    name: "Academie Les Genies",
    city: "Lubumbashi",
    date: "Inscrite recemment",
  },
  {
    name: "Institut Moderne La Reussite",
    city: "Goma",
    date: "Inscrite recemment",
  },
  {
    name: "Complexe Scolaire Lumiere",
    city: "Kolwezi",
    date: "Inscrite recemment",
  },
];

const fallbackResultSlides: ResultSlide[] = [
  {
    school: "CS La Fortune",
    city: "Lubumbashi",
    students: [
      {
        studentid: "fallback-1",
        name: "Sarah K.",
        percent: "96%",
        image: "",
      },
      {
        studentid: "fallback-2",
        name: "Daniel M.",
        percent: "94%",
        image: "",
      },
      {
        studentid: "fallback-3",
        name: "Grace L.",
        percent: "92%",
        image: "",
      },
    ],
  },
  {
    school: "Bakhita",
    city: "Cabinda",
    students: [
      {
        studentid: "fallback-4",
        name: "Kevin B.",
        percent: "95%",
        image: "",
      },
      {
        studentid: "fallback-5",
        name: "Aline N.",
        percent: "93%",
        image: "",
      },
      {
        studentid: "fallback-6",
        name: "Joel P.",
        percent: "91%",
        image: "",
      },
    ],
  },
];

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatRegistrationDate(date: Date) {
  return `Inscrite le ${new Intl.DateTimeFormat("fr-FR").format(date)}`;
}

export async function getHomeData() {
  const [branches, partnaires, calendarEvents, grades] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        image: true,
        ville: true,
        pays: true,
        createdAt: true,
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
    }),
    prisma.partnaire.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        name: true,
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        isArchived: false,
        branch: {
          isActive: true,
        },
      },
      orderBy: { dateStart: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        dateStart: true,
        branch: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    }),
    prisma.studentGrade.findMany({
      where: {
        branch: {
          isActive: true,
        },
      },
      orderBy: { score: "desc" },
      take: 30,
      select: {
        id: true,
        score: true,
        branch: {
          select: {
            name: true,
            ville: true,
          },
        },
        student: {
          select: {
            branchMember: {
              select: {
                member: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        prenom: true,
                        postnom: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const dynamicSchools: HomeSchool[] = branches
    .slice(0, 6)
    .map((branch, index) => {
      const studentsCount = branch.branchemembers.reduce(
        (total, member) => total + member._count.student,
        0,
      );
      const city = branch.ville || branch.pays || "RDC";

      return {
        name: branch.name,
        city,
        students: studentsCount,
        heroLabel: "Ecole partenaire verifiee",
        heroTitle: `${branch.name} accueille ${studentsCount || "plusieurs"} eleves a ${city}`,
        image:
          normalizeImageSrc(branch.image) ||
          fallbackSchools[index % fallbackSchools.length].image,
      };
    });

  const dynamicEvents: HomeEvent[] = calendarEvents.map((event, index) => ({
    title: event.title || "Evenement scolaire",
    school: event.branch.name,
    date: formatShortDate(event.dateStart),
    image:
      normalizeImageSrc(event.branch.image) ||
      fallbackEvents[index % fallbackEvents.length].image,
  }));

  const dynamicNewSchools: NewSchool[] = branches.slice(0, 4).map((branch) => ({
    name: branch.name,
    city: branch.ville || branch.pays || "RDC",
    date: formatRegistrationDate(branch.createdAt),
  }));

  const groupedResults = new Map<string, ResultSlide>();

  for (const grade of grades) {
    const user = grade.student.branchMember.member.user;
    const studentName = [user.prenom, user.name].filter(Boolean).join(" ");
    const schoolName = grade.branch.name;
    const current = groupedResults.get(schoolName) || {
      school: schoolName,
      city: grade.branch.ville || "RDC",
      students: [],
    };

    if (
      current.students.length < 3 &&
      !current.students.some((student) => student.studentid === user.id)
    ) {
      current.students.push({
        studentid: user.id,
        name: studentName || "Eleve",
        percent: `${Math.round(grade.score)}%`,
        image: normalizeImageSrc(user.image),
      });
    }

    groupedResults.set(schoolName, current);
  }

  const resultSlides = Array.from(groupedResults.values()).slice(0, 3);

  return {
    schools: dynamicSchools.length ? dynamicSchools : fallbackSchools,
    events: dynamicEvents.length ? dynamicEvents : fallbackEvents,
    partners: partnaires.length
      ? partnaires.map((partnaire) => partnaire.name)
      : fallbackPartners,
    newSchools: dynamicNewSchools.length
      ? dynamicNewSchools
      : fallbackNewSchools,
    resultSlides: resultSlides.length ? resultSlides : fallbackResultSlides,
    stats: {
      schools: branches.length || 300,
      students:
        branches.reduce(
          (total, branch) =>
            total +
            branch.branchemembers.reduce(
              (branchTotal, member) => branchTotal + member._count.student,
              0,
            ),
          0,
        ) || 50000,
      verified: branches.length ? 100 : 98,
    },
  };
}
