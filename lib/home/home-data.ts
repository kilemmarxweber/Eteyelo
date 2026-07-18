import "server-only";

import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { getStudentCountsByBranchId } from "@/lib/branch-student-count";
import { prisma } from "@/lib/prisma";
import { getHomeResultSlides } from "@/lib/public-results";
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

export type HomeStatsSegment = {
  key: "schools" | "centres" | "universities";
  title: string;
  countLabel: string;
  peopleLabelSingular: string;
  peopleLabelPlural: string;
  heroTitleBefore: string;
  heroSubtitle: string;
  count: number;
  people: number;
};

const HOME_SEGMENT_META: Record<
  HomeStatsSegment["key"],
  Omit<HomeStatsSegment, "key" | "count" | "people">
> = {
  schools: {
    title: "Écoles",
    countLabel: "Écoles",
    peopleLabelSingular: "Élève",
    peopleLabelPlural: "Élèves",
    heroTitleBefore: "L'excellence de l'enseignement scolaire en",
    heroSubtitle:
      "Consultez les écoles partenaires vérifiées, leurs filières, inscriptions et résultats scolaires, en toute transparence.",
  },
  centres: {
    title: "Centres de formation",
    countLabel: "Centres de form...",
    peopleLabelSingular: "Apprenant",
    peopleLabelPlural: "Apprenants",
    heroTitleBefore: "La formation professionnelle certifiante en",
    heroSubtitle:
      "Explorez les centres de formation agréés, leurs programmes, sessions et parcours certifiants, accessibles en ligne.",
  },
  universities: {
    title: "Universités",
    countLabel: "Universités",
    peopleLabelSingular: "Étudiant",
    peopleLabelPlural: "Étudiants",
    heroTitleBefore: "L'enseignement supérieur d'excellence en",
    heroSubtitle:
      "Découvrez les universités partenaires, leurs filières, auditoires, inscriptions et relevés de notes, centralisés sur une plateforme unique.",
  },
};

export type HomeData = {
  schools: HomeSchool[];
  events: HomeEvent[];
  partners: HomePartner[];
  newSchools: NewSchool[];
  resultSlides: ResultSlide[];
  stats: {
    verified: number;
    segments: HomeStatsSegment[];
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
const DEFAULT_SCHOOL_IMAGE = KLAMBOCORE_DEFAULT_IMAGE_PATH;

const DEFAULT_EVENT_IMAGE = KLAMBOCORE_DEFAULT_IMAGE_PATH;

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

const fallbackStatsSegments: HomeStatsSegment[] = (
  ["schools", "centres", "universities"] as const
).map((key) => ({
  key,
  ...HOME_SEGMENT_META[key],
  count:
    key === "schools" ? 300 : key === "centres" ? 24 : 18,
  people:
    key === "schools" ? 50000 : key === "centres" ? 3200 : 8500,
}));

const fallbackStats = {
  verified: 100,
  segments: fallbackStatsSegments,
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

function sumBranchPeople(
  branches: Array<{ id: string }>,
  studentCountsByBranchId: Map<string, number>,
) {
  return branches.reduce(
    (total, branch) => total + (studentCountsByBranchId.get(branch.id) ?? 0),
    0,
  );
}

function buildStatsSegments(
  branches: Array<{
    id: string;
    typebranch: string;
  }>,
  studentCountsByBranchId: Map<string, number>,
): HomeStatsSegment[] {
  const useFallback = branches.length === 0;
  const schoolBranches = branches.filter(
    (branch) =>
      branch.typebranch === "PRIMAIRE" || branch.typebranch === "SECONDAIRE",
  );
  const centreBranches = branches.filter(
    (branch) => branch.typebranch === "CENTRE_FORMATION",
  );
  const universityBranches = branches.filter(
    (branch) => branch.typebranch === "UNIVERSITE",
  );

  const schoolPeople = sumBranchPeople(schoolBranches, studentCountsByBranchId);
  const centrePeople = sumBranchPeople(centreBranches, studentCountsByBranchId);
  const universityPeople = sumBranchPeople(
    universityBranches,
    studentCountsByBranchId,
  );

  const fallbackByKey = Object.fromEntries(
    fallbackStatsSegments.map((segment) => [segment.key, segment]),
  ) as Record<HomeStatsSegment["key"], HomeStatsSegment>;

  return (
    [
      {
        key: "schools" as const,
        count: useFallback ? fallbackByKey.schools.count : schoolBranches.length,
        people: useFallback ? fallbackByKey.schools.people : schoolPeople,
      },
      {
        key: "centres" as const,
        count: useFallback ? fallbackByKey.centres.count : centreBranches.length,
        people: useFallback ? fallbackByKey.centres.people : centrePeople,
      },
      {
        key: "universities" as const,
        count: useFallback
          ? fallbackByKey.universities.count
          : universityBranches.length,
        people: useFallback
          ? fallbackByKey.universities.people
          : universityPeople,
      },
    ] as const
  ).map(({ key, count, people }) => ({
    key,
    ...HOME_SEGMENT_META[key],
    count,
    people,
  }));
}

export async function getHomeData(): Promise<HomeData> {
  try {
    const [branches, partnaires, calendarEvents, resultSlides] =
      await Promise.all([
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
            typebranch: true,
            createdAt: true,
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
        getHomeResultSlides(3),
      ]);

    const allBranches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        typebranch: true,
      },
    });

    const studentCountsByBranchId =
      await getStudentCountsByBranchId(allBranches);

    const dynamicSchools: HomeSchool[] = branches.slice(0, 6).map((branch) => {
      const studentsCount = studentCountsByBranchId.get(branch.id) ?? 0;

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

    return {
      schools: dynamicSchools.length ? dynamicSchools : fallbackSchools,
      events: dynamicEvents.length ? dynamicEvents : fallbackEvents,
      partners: dynamicPartners.length ? dynamicPartners : fallbackPartners,
      newSchools: dynamicNewSchools.length
        ? dynamicNewSchools
        : fallbackNewSchools,
      resultSlides,
      stats: {
        verified: allBranches.length ? 100 : fallbackStats.verified,
        segments: buildStatsSegments(allBranches, studentCountsByBranchId),
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
