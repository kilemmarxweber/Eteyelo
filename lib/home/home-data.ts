import "server-only";

import { prisma } from "@/lib/prisma";
import { getBranchImage, normalizeImageSrc } from "@/lib/utils";

export type HomeSchool = {
  id: string;
  name: string;
  city: string;
  students: number;
  heroLabel: string;
  heroTitle: string;
  logo: string;
  ecole: string[];
  event: string[];
  gallery: string[];
};

export type HomeEvent = {
  title: string;
  school: string;
  date: string;
  image: string;
};

export type HomePartner = {
  name: string;
  type: string;
  secteur?: string;
  city?: string;
  image: string;
  logo: string;
  website: string;
};

export type NewSchool = {
  name: string;
  city: string;
  date: string;
};

export type ResultSlide = {
  school: string;
  city: string;
  students: {
    studentid: string;
    name: string;
    percent: string;
    image: string;
  }[];
};

export type BranchImages = {
  logo?: string;
  ecole: string[];
  event: string[];
  gallery: string[];
};

export type HomeData = {
  schools: HomeSchool[];
  events: HomeEvent[];
  partners: HomePartner[];
  newSchools: NewSchool[];
  resultSlides: ResultSlide[];
  stats: {
    schools: number;
    students: number;
    verified: number;
  };
};

export const fallbackSchools: HomeSchool[] = [
  {
    id: "fallback-cs-la-fortune",
    name: "CS La Fortune",
    city: "Lubumbashi",
    students: 1200,
    heroLabel: "Ecole partenaire verifiee",
    heroTitle: "CS La Fortune accompagne 1 200 eleves a Lubumbashi",
    logo: "",
    ecole: [],
    event: [],
    gallery: [],
  },
  {
    id: "fallback-bakhita",
    name: "Bakhita",
    city: "Cabinda",
    students: 850,
    heroLabel: "Institut actif a Cabinda",
    heroTitle: "Bakhita valorise ses filieres, evenements et resultats",
    logo: "",
    ecole: [],
    event: [],
    gallery: [],
  },
  {
    id: "fallback-padre-pitra",
    name: "Complexo Escolar Privado Padre Pitra",
    city: "Cabinda",
    students: 970,
    heroLabel: "Complexe scolaire partenaire",
    heroTitle: "Padre Pitra gagne en visibilite aupres des familles",
    logo: "",
    ecole: [],
    event: [],
    gallery: [],
  },
];

export const fallbackEvents: HomeEvent[] = [
  {
    title: "Journee portes ouvertes",
    school: "CS La Fortune",
    date: "12 Juin",
    image:
      "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Remise des diplomes",
    school: "Bakhita",
    date: "18 Juin",
    image:
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Concours scientifique",
    school: "Padre Pitra",
    date: "25 Juin",
    image:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
  },
];
const DEFAULT_SCHOOL_IMAGE =
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1200&auto=format&fit=crop";

const DEFAULT_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=1200&auto=format&fit=crop";

const DEFAULT_PROFILE_IMAGE =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop";

function normalizeImageList(
  images: Array<string | null | undefined>,
): string[] {
  return images
    .filter((image): image is string => {
      return typeof image === "string" && image.trim().length > 0;
    })
    .map((image) => normalizeImageSrc(image));
}

function firstImage(
  images: string[],
  fallback: string = DEFAULT_SCHOOL_IMAGE,
): string {
  return images.find(Boolean) ?? fallback;
}
export const fallbackPartners: HomePartner[] = [
  {
    name: "CS La Fortune",
    type: "Ecole partenaire",
    secteur: "Education",
    city: "Lubumbashi",
    image: "",
    logo: "",
    website: "",
  },
  {
    name: "Bakhita",
    type: "Institut partenaire",
    secteur: "Education",
    city: "Cabinda",
    image: "",
    logo: "",
    website: "",
  },
];

export const galleryImages = [
  "galery-1.jpeg",
  "galery-2.jpeg",
  "galery-3.jpeg",
  "galery-4.jpeg",
  "galery-5.jpeg",
  "galery-6.jpeg",
].map((image) => normalizeImageSrc(image));

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

const fallbackStats = {
  schools: 300,
  students: 50000,
  verified: 98,
};

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatRegistrationDate(date: Date) {
  return `Inscrite le ${new Intl.DateTimeFormat("fr-FR").format(date)}`;
}

function getFallbackHomeData(): HomeData {
  return {
    schools: fallbackSchools,
    events: fallbackEvents,
    partners: fallbackPartners,
    newSchools: fallbackNewSchools,
    resultSlides: [],
    stats: fallbackStats,
  };
}

export async function getHomeData(): Promise<HomeData> {
  try {
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
          type: true,
          image: true,
          logo: true,
          website: true,
          ville: true,
          secteur: true,
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
          title: true,
          image: true,
          dateStart: true,
          branch: {
            select: {
              name: true,
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

    const dynamicSchools: HomeSchool[] = branches.slice(0, 6).map((branch) => {
      const studentsCount = branch.branchemembers.reduce(
        (total, member) => total + member._count.student,
        0,
      );

      const city = branch.ville || branch.pays || "RDC";
      const images = getBranchImage(branch.image);

      const logo = images.logo
        ? normalizeImageSrc(images.logo)
        : DEFAULT_SCHOOL_IMAGE;

      const schoolImages = normalizeImageList(images.ecole);
      const eventImages = normalizeImageList(images.event);
      const galleryImages = normalizeImageList(images.gallery);

      return {
        id: branch.id,
        name: branch.name,
        city,
        students: studentsCount,
        heroLabel: "École partenaire vérifiée",
        heroTitle: `${branch.name} accueille ${
          studentsCount > 0 ? studentsCount : "plusieurs"
        } élèves à ${city}`,
        logo,
        ecole:
          schoolImages.length > 0
            ? schoolImages
            : [firstImage(eventImages, logo)],
        event:
          eventImages.length > 0
            ? eventImages
            : [firstImage(schoolImages, logo)],
        gallery:
          galleryImages.length > 0
            ? galleryImages
            : [...schoolImages, ...eventImages].filter(Boolean),
      };
    });

    const dynamicEvents: HomeEvent[] = calendarEvents.map((event, index) => {
      const fallbackEvent = fallbackEvents[index % fallbackEvents.length];

      return {
        title: event.title || "Événement scolaire",
        school: event.branch.name,
        date: formatShortDate(event.dateStart),
        image: event.image
          ? normalizeImageSrc(event.image)
          : fallbackEvent?.image || DEFAULT_EVENT_IMAGE,
      };
    });

    const dynamicNewSchools: NewSchool[] = branches
      .slice(0, 4)
      .map((branch) => ({
        name: branch.name,
        city: branch.ville || branch.pays || "RDC",
        date: formatRegistrationDate(branch.createdAt),
      }));

    const dynamicPartners: HomePartner[] = partnaires.map((partnaire) => ({
      name: partnaire.name,
      type: partnaire.type || "Partenaire",
      secteur: partnaire.secteur || undefined,
      city: partnaire.ville || undefined,
      logo: partnaire.logo ? normalizeImageSrc(partnaire.logo) : "",
      image: partnaire.image ? normalizeImageSrc(partnaire.image) : "",
      website: partnaire.website?.trim() ?? "",
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
          name: studentName || "Élève",
          percent: `${Math.round(grade.score)}%`,
          image: user.image
            ? normalizeImageSrc(user.image)
            : DEFAULT_PROFILE_IMAGE,
        });
      }

      groupedResults.set(schoolName, current);
    }

    const studentTotal = branches.reduce(
      (total, branch) =>
        total +
        branch.branchemembers.reduce(
          (branchTotal, member) => branchTotal + member._count.student,
          0,
        ),
      0,
    );

    return {
      schools: dynamicSchools.length ? dynamicSchools : fallbackSchools,
      events: dynamicEvents.length ? dynamicEvents : fallbackEvents,
      partners: dynamicPartners.length ? dynamicPartners : fallbackPartners,
      newSchools: dynamicNewSchools.length
        ? dynamicNewSchools
        : fallbackNewSchools,
      resultSlides: Array.from(groupedResults.values()).slice(0, 3),
      stats: {
        schools: branches.length || fallbackStats.schools,
        students: studentTotal || fallbackStats.students,
        verified: branches.length ? 100 : fallbackStats.verified,
      },
    };
  } catch (error) {
    console.error(
      "Impossible de recuperer les donnees de la page d'accueil",
      error,
    );
    return getFallbackHomeData();
  }
}
