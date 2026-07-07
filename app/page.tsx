import {
  Search,
  School,
  GraduationCap,
  Users,
  Trophy,
  CalendarDays,
  BarChart3,
  Camera,
  ChevronDown,
  MapPin,
  Star,
  Facebook,
  Instagram,
  Youtube,
  Mail,
  Phone,
  Globe,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/animated-counter";
import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";
import { prisma } from "@/lib/prisma";
import { getBranchImage, normalizeImageSrc } from "@/lib/utils";
const schools = [
  {
    name: "CS La Fortune",
    city: "Lubumbashi",
    students: 1200,
    heroLabel: "École partenaire vérifiée",
    heroTitle: "CS La Fortune accompagne 1 200 élèves à Lubumbashi",
    logo: "",
    ecole: [],
    event: [],
    gallery: [],
  },
  {
    name: "Bakhitafhhfjkk",
    city: "Cabinda",
    students: 850,
    heroLabel: "Institut actif à Cabinda",
    heroTitle: "Bakhita valorise ses filières, événements et résultats",
    logo: "",
    ecole: [],
    event: [],
    gallery: [],
  },
  {
    name: "Complexo Escolar Privado Padre Pitra",
    city: "Cabinda",
    students: 970,
    heroLabel: "Complexe scolaire partenaire",
    heroTitle: "Padre Pitra gagne en visibilité auprès des familles",
    logo: "",
    ecole: [],
    event: [],
    gallery: [],
  },
];

const events = [
  {
    title: "Journée portes ouvertes",
    school: "CS La Fortune",
    date: "12 Juin",
    image:
      "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Remise des diplômes",
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

const partners = [
  {
    name: "CS La Fortune",
    type: "École partenaire",
    secteur: "Éducation",
    city: "Lubumbashi",
    image: "",
    logo: "",
    website: "",
  },
  {
    name: "Bakhita",
    type: "Institut partenaire",
    secteur: "Éducation",
    city: "Cabinda",
    image: "",
    logo: "",
    website: "",
  },
];
type HomePartner = {
  name: string;
  type: string;
  secteur: string;
  city: string;
  image: string;
  logo: string;
  website: string;
};
const galleryImages = [
  "/uploads/galery-1.jpeg",
  "/uploads/galery-2.jpeg",
  "/uploads/galery-3.jpeg",
  "/uploads/galery-4.jpeg",
  "/uploads/galery-5.jpeg",
  "/uploads/galery-6.jpeg",
];

const socialLinks = [
  { icon: Facebook, label: "Facebook", className: "bg-blue-600" },
  { icon: Instagram, label: "Instagram", className: "bg-pink-600" },
  { icon: Youtube, label: "YouTube", className: "bg-red-600" },
  { icon: Globe, label: "Site web", className: "bg-blue-950" },
];

const serviceMenuItems = [
  {
    label: "Gestion scolaire",
    href: "#services",
    description: "Classes, notes, prÃ©sences et administration.",
    icon: School,
  },
  {
    label: "FiliÃ¨res",
    href: "/filieres",
    description: "Formations, options et parcours disponibles.",
    icon: GraduationCap,
  },
  {
    label: "RÃ©sultats",
    href: "#resultats",
    description: "Bulletins, classements et performances.",
    icon: BarChart3,
  },
  {
    label: "Inscription Ã©cole",
    href: "/inscription-ecole",
    description: "Ajoutez votre Ã©tablissement sur Klambocore.",
    icon: UserPlus,
  },
];

type HomeSchool = (typeof schools)[number];
type HomeEvent = (typeof events)[number];
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
export type BranchImages = {
  logo?: string;
  ecole: string[];
  event: string[];
  gallery: string[];
};
export type HomeSchools = {
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

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatRegistrationDate(date: Date) {
  return `Inscrite le ${new Intl.DateTimeFormat("fr-FR").format(date)}`;
}

async function getHomeData() {
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
        id: true,
        name: true,
        type: true,
        secteur: true,
        description: true,
        image: true,
        logo: true,
        website: true,
        ville: true,
        pays: true,
        isFeatured: true,
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        branch: {
          isActive: true,
        },
      },
      orderBy: { dateStart: "desc" },
      take: 6,
      select: {
        id: true,
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

  const dynamicSchools: HomeSchools[] = branches
    .slice(0, 6)
    .map((branch, index) => {
      const studentsCount = branch.branchemembers.reduce(
        (total, member) => total + member._count.student,
        0,
      );

      const city = branch.ville || branch.pays || "RDC";

      const images = getBranchImage(branch.image);

      // console.log("BRANCH:", branch.name);
      // console.log("RAW IMAGE:", branch.image);
      // console.log("PARSED IMAGES:", images);
      // console.log("ECOLE:", images.ecole);
      // console.log("EVENT:", images.event);
      // console.log("GALLERY:", images.gallery);
      return {
        name: branch.name,
        city,
        students: studentsCount,

        heroLabel: "Ecole partenaire verifiee",

        heroTitle: `${branch.name} accueille ${
          studentsCount || "plusieurs"
        } eleves a ${city}`,
        logo: images.logo ?? "",

        ecole:
          images.ecole.length > 0
            ? images.ecole
            : schools[index % schools.length].ecole,

        event:
          images.event.length > 0
            ? images.event
            : schools[index % schools.length].event,

        gallery:
          images.gallery.length > 0
            ? images.gallery
            : schools[index % schools.length].gallery,
      };
    });
  // const dynamicSchoolsEvent: HomeSchools[] = branches
  //   .slice(0, 6)
  //   .map((branch, index) => {
  //     const studentsCount = branch.branchemembers.reduce(
  //       (total, member) => total + member._count.student,
  //       0,
  //     );

  //     const city = branch.ville || branch.pays || "RDC";

  //     const images = getBranchImage(branch.image);

  //     return {
  //       name: branch.name,
  //       city,
  //       students: studentsCount,

  //       heroLabel: "Ecole partenaire verifiee",

  //       heroTitle: `${branch.name} accueille ${
  //         studentsCount || "plusieurs"
  //       } eleves a ${city}`,
  //       logo: images.logo ?? "",
  //       ecole:
  //         images.ecole.length > 0
  //           ? images.ecole
  //           : schools[index % schools.length].ecole,

  //       event:
  //         images.event.length > 0
  //           ? images.event
  //           : schools[index % schools.length].event,

  //       gallery:
  //         images.gallery.length > 0
  //           ? images.gallery
  //           : schools[index % schools.length].gallery,
  //     };
  //   });

  const dynamicEvents: HomeEvent[] = calendarEvents.map((event, index) => ({
    title: event.title || "Evenement scolaire",
    school: event.branch.name,
    date: formatShortDate(event.dateStart),
    image: event.image
      ? normalizeImageSrc(event.image)
      : events[index % events.length].image,
  }));

  const dynamicNewSchools: NewSchool[] = branches.slice(0, 4).map((branch) => ({
    name: branch.name,
    city: branch.ville || branch.pays || "RDC",
    date: formatRegistrationDate(branch.createdAt),
  }));
  const dynamicPartners = partnaires.map((partnaire) => ({
    name: partnaire.name,
    type: partnaire.type,
    image: normalizeImageSrc(partnaire.image),
    logo: partnaire.logo ? normalizeImageSrc(partnaire.logo) : "",
    website: partnaire.website ?? "",
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
      !current.students.some((s) => s.studentid === user.id)
    ) {
      current.students.push({
        studentid: user.id,
        name: studentName || "Élève",
        percent: `${Math.round(grade.score)}%`,
        image: normalizeImageSrc(user.image),
      });
    }

    groupedResults.set(schoolName, current);
  }

  return {
    schools: dynamicSchools.length ? dynamicSchools : schools,
    events: dynamicEvents.length ? dynamicEvents : events,
    partners: dynamicPartners.length ? dynamicPartners : partners,
    newSchools: dynamicNewSchools.length
      ? dynamicNewSchools
      : fallbackNewSchools,
    resultSlides: Array.from(groupedResults.values()).slice(0, 3),
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

export default async function HomePage() {
  const { schools, events, partners, newSchools, resultSlides, stats } =
    await getHomeData();

  const schoolImageSlides = schools.filter((school) => school.ecole.length > 0);

  const galleryFromBranches = schools.flatMap((school) => school.gallery);

  const galleryToShow = Array.from(
    new Set([...galleryFromBranches, ...galleryImages]),
  ).filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* TOP BAR */}
      <div className="bg-blue-950 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-2 px-3 py-2 text-[10px] sm:px-6 sm:text-xs">
          <span className="text-left">🇨🇩 Marketing scolaire</span>

          <span className="text-center">
            🏫 Écoles, instituts & universités
          </span>

          <span className="text-right">📊 Résultats en ligne</span>
        </div>
      </div>

      <HomeNavbar />
      {/* NAVBAR */}
      <header className="hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:gap-5 sm:px-6">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white">
              <School />
            </div>

            <div>
              <h1 className="text-xl font-black text-blue-700">Klambocore</h1>
              <p className="text-[11px] font-medium text-slate-400">
                Gestion scolaire RDC
              </p>
            </div>
          </Link>

          <div className="relative hidden flex-1 md:block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-blue-950" />
            <Input
              className="rounded-full border-blue-100 bg-blue-50/70 pl-10 text-blue-950 placeholder:text-blue-950/45 focus-visible:ring-blue-950"
              placeholder="Rechercher une école, ville ou filière..."
            />
          </div>

          {/* NAVBAR LINKS */}
          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 lg:flex">
            <div className="group relative">
              <button
                type="button"
                className="flex items-center gap-1 rounded-full px-1 py-2 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-950"
              >
                Services
                <ChevronDown className="h-4 w-4 transition duration-300 group-hover:rotate-180 group-focus-within:rotate-180" />
              </button>

              <div className="invisible absolute left-1/2 top-full z-50 w-[26rem] -translate-x-1/2 translate-y-3 rounded-3xl border border-blue-100 bg-white p-3 opacity-0 shadow-2xl shadow-blue-950/10 transition duration-200 group-hover:visible group-hover:translate-y-2 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-2 group-focus-within:opacity-100">
                <div className="grid gap-2">
                  {serviceMenuItems.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-blue-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-white">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-black text-blue-950">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            {[
              ["Établissements", "#etablissements"],
              ["Résultats", "#resultats"],
              ["Contact", "#contact"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="relative transition hover:text-blue-600 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-blue-600 after:transition-all after:duration-300 hover:after:w-full"
              >
                {label}
              </a>
            ))}
          </nav>

          <Button
            variant="outline"
            className="hidden rounded-full border-blue-950 text-blue-950 hover:bg-blue-950 hover:text-white sm:inline-flex"
          >
            Se connecter
          </Button>

          <Button className="rounded-full bg-blue-600 text-xs hover:bg-blue-700 sm:text-sm">
            Inscrire une école
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_35%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] lg:items-center lg:py-24">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <Badge className="mb-5 rounded-full bg-white/20 text-white">
              Plateforme SaaS de marketing scolaire
            </Badge>
            <h2 className="text-4xl font-black leading-tight sm:text-5xl md:text-6xl text-white">
              Trouvez les meilleurs établissements en{" "}
              <span className="text-yellow-300 text-xl sm:text-2xl md:text-3xl">
                Afrique
              </span>
            </h2>
            <p className="mx-auto mt-6 w-full text-base leading-7 text-blue-50 sm:w-[36rem] sm:text-lg lg:mx-0">
              Découvrez les écoles partenaires, leurs filières, événements,
              photos, résultats scolaires, inscriptions et résultats en ligne.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
              <Button
                asChild
                className="rounded-full bg-blue-950 px-7 text-white hover:bg-blue-900"
              >
                <Link href="/inscription-eleve">Inscrire un élève</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="rounded-full border-white bg-white text-slate-950 hover:bg-slate-100 hover:text-slate-950"
              >
                <Link href="/rejoindre-klambocore">Rejoindre Klambocore</Link>
              </Button>
            </div>
            <div className="mx-auto mt-10 grid w-full gap-3 sm:w-[36rem] sm:grid-cols-3 lg:mx-0">
              {[
                ["300+", "Établissements"],
                ["50K+", "Élèves inscrits"],
                ["98%", "Vérifié"],
              ].map(([, label], index) => {
                const Icon = [School, Users, CheckCircle2][index];
                const iconClassName = [
                  "bg-blue-100 text-blue-700",
                  "bg-cyan-100 text-cyan-700",
                  "bg-emerald-100 text-emerald-600",
                ][index];
                const countTo = [
                  Math.max(1, Math.round(stats.schools / 1000)),
                  Math.max(1, Math.round(stats.students / 1000)),
                  100,
                ][index];
                const suffix = ["K+", "K+", "%"][index];

                return (
                  <div
                    key={label}
                    className="flex min-h-20 items-center gap-3 rounded-2xl border border-white/15 bg-white/15 px-4 py-3 text-left backdrop-blur"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-black leading-none sm:text-3xl">
                        <AnimatedCounter end={countTo} suffix={suffix} />
                      </p>
                      <p className="mt-1 whitespace-normal text-sm leading-tight text-blue-50">
                        {label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Ecole images schools*/}
          <div className="mx-auto w-full rounded-[1.5rem] bg-white/15 p-2 shadow-2xl backdrop-blur sm:w-[36rem] sm:rounded-[2rem] sm:p-3 lg:w-full">
            <div className="relative min-h-[300px] overflow-hidden rounded-[1.25rem] bg-blue-950 sm:min-h-[400px] sm:rounded-[1.5rem] lg:min-h-[460px]">
              {schoolImageSlides.map((school, index) => {
                const image = school.ecole[0];

                if (!image) return null;

                return (
                  <div
                    key={school.name}
                    className="absolute inset-0 opacity-0 motion-reduce:animate-none"
                    style={{
                      animation: `hero-school-slide ${schoolImageSlides.length * 5}s infinite`,
                      animationDelay: `${index * 5}s`,
                      opacity: index === 0 ? 1 : 0,
                    }}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url('${image}')`,
                      }}
                    />

                    <div className="relative z-10 flex min-h-[300px] items-end rounded-[1.25rem] bg-blue-950/45 p-4 sm:min-h-[400px] sm:rounded-[1.5rem] sm:p-6 lg:min-h-[460px]">
                      <div className="w-full rounded-2xl bg-white p-4 text-slate-900 shadow-xl sm:w-[26rem] sm:p-5">
                        <p className="text-sm font-bold text-blue-600">
                          {school.heroLabel}
                        </p>
                        <h3 className="mt-1 text-lg font-black sm:text-xl">
                          {school.heroTitle}
                        </h3>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="hidden">
                <div className="w-full rounded-2xl bg-white p-4 text-slate-900 shadow-xl sm:w-[26rem] sm:p-5">
                  <p className="text-sm font-bold text-blue-600">
                    École partenaire vérifiée
                  </p>
                  <h3 className="mt-1 text-lg font-black sm:text-xl">
                    Donnez plus de visibilité à votre établissement
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK SERVICES */}
      <section className="mx-auto -mt-10 max-w-7xl px-6">
        <div className="relative z-10 grid gap-4 rounded-[2rem] border border-blue-100 bg-white/95 p-4 shadow-2xl shadow-blue-950/10 backdrop-blur md:grid-cols-3">
          {[
            {
              icon: School,
              title: "Établissements",
              text: "Trouvez écoles, instituts et universités partout en RDC.",
            },
            {
              icon: GraduationCap,
              title: "Filières",
              text: "Découvrez les formations et spécialisations disponibles.",
            },
            {
              icon: CheckCircle2,
              title: "Inscrire une école",
              text: "Ajoutez votre établissement et augmentez votre visibilité.",
            },
          ].map((item, index) => {
            const iconClassName = [
              "bg-blue-950 text-white",
              "bg-cyan-500 text-white",
              "bg-emerald-500 text-white",
            ][index];
            const haloClassName = ["bg-blue-50", "bg-cyan-50", "bg-emerald-50"][
              index
            ];

            return (
              <div
                key={item.title}
                className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10"
              >
                <div
                  className={`absolute -right-10 -top-10 h-28 w-28 rounded-full ${haloClassName}`}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${iconClassName}`}
                  >
                    <item.icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-950">
                    0{index + 1}
                  </span>
                </div>
                <div className="relative mt-6">
                  <h3 className="text-xl font-black text-blue-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">
                    {item.text}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-700">
                      Explorer
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-950 text-white transition group-hover:translate-x-1">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ETABLISSEMENTS */}
      <section id="etablissements" className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge className="bg-blue-100 text-blue-700">
              Écoles populaires
            </Badge>

            <h2 className="mt-3 text-3xl font-black text-blue-950">
              Établissements partenaires
            </h2>
          </div>

          <a
            href="/etablissements"
            className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-200"
          >
            Voir tous <ArrowRight className="inline h-4 w-4" />
          </a>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.75fr_0.85fr] lg:items-start">
          {/* CARDS ÉTABLISSEMENTS schoolEvents */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {schools.slice(0, 3).map((school) => (
              <article
                key={school.name}
                className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-blue-100 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10"
              >
                <div className="relative h-48 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `url('${school.event[0]}')`,
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-blue-950/70 via-blue-950/10 to-transparent" />

                  <Badge className="absolute left-4 top-4 bg-white/90 text-blue-950 backdrop-blur">
                    {school.city}
                  </Badge>
                </div>

                <div className="p-5">
                  <h3 className="line-clamp-2 text-lg font-black text-blue-950">
                    {school.name}
                  </h3>

                  <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm text-blue-950">
                    <Users className="h-4 w-4 text-blue-700" />
                    {school.students} élèves inscrits
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* BLOC IMAGE DROITE schoolEvents */}
          <div className="relative h-[500px] self-start overflow-hidden rounded-3xl shadow-2xl shadow-blue-950/15">
            {schools.map((school, index) => (
              <div
                key={`${school.name}-event-slider`}
                className="absolute inset-0 opacity-0 motion-reduce:animate-none"
                style={{
                  animation: `hero-school-slide ${schools.length * 60}s infinite`,
                  animationDelay: `${index * 60}s`,
                  opacity: index === 0 ? 1 : 0,
                }}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url('${school.event[0]}')`,
                  }}
                />

                <div className="relative z-10 flex h-full items-end bg-gradient-to-t from-blue-950 via-blue-950/70 to-blue-950/10 p-8">
                  <div>
                    <Badge className="mb-4 bg-white/20 text-white backdrop-blur">
                      {school.city}
                    </Badge>

                    <h3 className="text-3xl font-black leading-tight text-white">
                      {school.name}
                    </h3>

                    <p className="mt-4 text-sm leading-6 text-blue-100">
                      {school.heroTitle}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <Badge className="bg-cyan-100 text-cyan-700">
              Solutions informatiques
            </Badge>

            <h2 className="mt-3 text-4xl font-black text-blue-950">
              Digitalisez la gestion de votre établissement
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Gestion scolaire",
                text: "Administration des élèves, classes, notes, bulletins, absences et emplois du temps.",
                bg: "bg-blue-50",
                border: "border-blue-100",
                iconBg: "bg-blue-600",
                iconColor: "text-white",
              },
              {
                icon: School,
                title: "Portail Parents",
                text: "Communication, paiements, résultats, annonces et suivi scolaire en temps réel.",
                bg: "bg-emerald-50",
                border: "border-emerald-100",
                iconBg: "bg-emerald-600",
                iconColor: "text-white",
              },
              {
                icon: Trophy,
                title: "Résultats & Statistiques",
                text: "Classements, performances, meilleurs élèves et tableaux de bord décisionnels.",
                bg: "bg-orange-50",
                border: "border-orange-100",
                iconBg: "bg-orange-500",
                iconColor: "text-white",
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`group rounded-3xl border ${item.border} ${item.bg} p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl`}
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl ${item.iconBg} ${item.iconColor} shadow-lg`}
                >
                  <item.icon className="h-8 w-8" />
                </div>

                <h3 className="mt-6 text-xl font-black text-blue-950">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.text}
                </p>

                <div className="mt-6">
  <Link
    href="/produits-digitaux"
    className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition group-hover:bg-blue-600 group-hover:text-white"
  >
    En savoir plus →
  </Link>
</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EVENTS + GALERIE */}
      <section className="mx-auto max-w-7xl px-6 py-5">
        <div className="mb-4">
          <h2 className="text-2xl font-black text-blue-950">
            Événements récents
          </h2>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.7fr_0.9fr]">
          {/* EVENTS À GAUCHE */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-blue-950">
                Derniers événements
              </h3>

              <a
                href="/evenements"
                className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-200"
              >
                Voir tous →
              </a>
            </div>
            {/* Evenement events*/}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.slice(0, 3).map((event) => (
                <article
                  key={event.title}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100"
                >
                  <div
                    className="h-32 bg-cover bg-center"
                    style={{
                      backgroundImage: `url('${event.image}')`,
                    }}
                  />

                  <div className="p-4">
                    <Badge className="bg-blue-100 text-blue-700">
                      <CalendarDays className="mr-1 h-3 w-3" />
                      {event.date}
                    </Badge>

                    <h3 className="mt-3 line-clamp-2 text-sm font-black text-blue-950">
                      {event.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {event.school}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* GALERIE À DROITE gallery*/}
          <div className="self-start rounded-3xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-950" />
                <h3 className="text-lg font-black text-blue-950">
                  Galerie photos
                </h3>
              </div>

              <a
                href="/galerie"
                className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
              >
                Voir plus <ArrowRight className="inline h-3 w-3" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {galleryToShow.slice(0, 6).map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="aspect-square rounded-xl bg-cover bg-center"
                  style={{
                    backgroundImage: `url('${image}')`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INSCRIPTION */}
      <section className="bg-gradient-to-br from-blue-700 to-cyan-500 py-14 text-white">
        <div className="mx-auto grid max-w-7xl items-start gap-6 px-6 lg:grid-cols-2">
          {/* Gauche */}
          <div className="rounded-3xl bg-white/15 p-8 backdrop-blur">
            <h2 className="text-3xl font-black">
              Candidature & inscriptions en ligne
            </h2>

            <p className="mt-3 text-sm leading-6 text-blue-50">
              Les parents peuvent inscrire leurs enfants, les candidats peuvent
              postuler, et les écoles reçoivent les demandes directement depuis
              leur espace d'administration.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-full bg-blue-950 px-6 text-white hover:bg-blue-900"
              >
                <Link href="/inscription-eleve">Inscrire un élève</Link>
              </Button>

              <Button
                variant="outline"
                className="rounded-full border-white bg-white px-6 text-slate-950 hover:bg-slate-100 hover:text-slate-950"
              >
                Déposer une candidature
              </Button>
            </div>
          </div>

          {/* Droite */}
          <div className="rounded-3xl bg-white p-8 text-slate-900 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Nouvelles écoles inscrites</h3>

              <Button
                variant="ghost"
                className="h-auto p-0 text-sm text-blue-600 hover:bg-transparent hover:text-blue-700"
              >
                Voir toutes →
              </Button>
            </div>

            <div className="hidden">
              {[
                {
                  name: "Groupe Scolaire Sainte Marie",
                  city: "Kinshasa",
                  date: "Inscrite le 28/07/2025",
                },
                {
                  name: "Académie Les Génies",
                  city: "Lubumbashi",
                  date: "Inscrite le 26/07/2025",
                },
                {
                  name: "Institut Moderne La Réussite",
                  city: "Goma",
                  date: "Inscrite le 24/07/2025",
                },
                {
                  name: "Complexe Scolaire Lumière",
                  city: "Kolwezi",
                  date: "Inscrite le 22/07/2025",
                },
              ].map((school) => (
                <div
                  key={school.name}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 transition hover:bg-slate-50"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {school.name}
                    </p>

                    <p className="text-xs text-slate-500">{school.city}</p>
                  </div>

                  <span className="whitespace-nowrap text-[11px] text-slate-400">
                    {school.date}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {newSchools.map((school) => (
                <div
                  key={school.name}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 transition hover:bg-slate-50"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {school.name}
                    </p>
                    <p className="text-xs text-slate-500">{school.city}</p>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-slate-400">
                    {school.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RESULTATS + ANNIVERSAIRES */}
      <section id="resultats" className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-blue-950 p-8 text-white sm:p-10">
            <Badge className="bg-white/10 text-cyan-300">Résultats</Badge>

            <div className="mt-6 grid gap-6 md:grid-cols-[1fr_170px] md:items-center">
              <div>
                <h2 className="text-4xl font-black">
                  Résultats scolaires en ligne
                </h2>
                <p className="mt-4 text-slate-300">
                  Suivez les meilleurs élèves par école, les taux de réussite et
                  les performances scolaires en temps réel.
                </p>

                <Button className="mt-8 rounded-full bg-cyan-400 text-blue-950 hover:bg-cyan-300">
                  Consulter les résultats
                </Button>
              </div>

              <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-cyan-400/20">
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(#22d3ee_0_85%,rgba(255,255,255,0.15)_85%_100%)]" />
                <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full bg-blue-950 text-center">
                  <span className="text-3xl font-black text-cyan-300">85%</span>
                  <span className="text-[11px] text-slate-300">Réussite</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
            <Badge className="bg-cyan-100 text-cyan-700">
              🏆 Meilleurs élèves
            </Badge>

            <h2 className="mt-3 text-3xl font-black">Résultats par école</h2>

            <p className="mt-2 text-sm text-slate-500">
              Découvrez les 3 meilleurs élèves des établissements partenaires
              avec leurs performances.
            </p>

            <div className="hidden">
              {[
                {
                  school: "CS La Fortune",
                  city: "Lubumbashi",
                  students: [
                    {
                      studentid: "1e",
                      name: "Grâce M.",
                      percent: "89%",
                      image:
                        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop",
                    },
                    {
                      studentid: "2e",
                      name: "David K.",
                      percent: "87%",
                      image:
                        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop",
                    },
                    {
                      studentid: "3e",
                      name: "Sarah L.",
                      percent: "85%",
                      image:
                        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=300&auto=format&fit=crop",
                    },
                  ],
                },
                {
                  school: "Bakhita",
                  city: "Cabinda",
                  students: [
                    {
                      studentid: "1ec",
                      name: "Jonathan K.",
                      percent: "91%",
                      image:
                        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop",
                    },
                    {
                      studentid: "2ec",
                      name: "Esther B.",
                      percent: "86%",
                      image:
                        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=300&auto=format&fit=crop",
                    },
                    {
                      studentid: "3ec",
                      name: "Samuel M.",
                      percent: "84%",
                      image:
                        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=300&auto=format&fit=crop",
                    },
                  ],
                },
                {
                  school: "Padre Pitra",
                  city: "Cabinda",
                  students: [
                    {
                      studentid: "22",
                      name: "Miguel A.",
                      percent: "90%",
                      image:
                        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300&auto=format&fit=crop",
                    },
                    {
                      studentid: "23",
                      name: "Helena P.",
                      percent: "88%",
                      image:
                        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop",
                    },
                    {
                      studentid: "24",
                      name: "Carlos D.",
                      percent: "82%",
                      image:
                        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop",
                    },
                  ],
                },
              ].map((result, index) => (
                <div
                  key={result.school}
                  className="absolute inset-0 opacity-0 motion-reduce:animate-none"
                  style={{
                    animation: "school-result-fade 12s infinite",
                    animationDelay: `${index * 4}s`,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-cyan-700">
                        {result.city}
                      </p>
                      <h3 className="text-lg font-black text-blue-950">
                        {result.school}
                      </h3>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {result.students.map((student, rank) => (
                      <div
                        key={student.studentid}
                        className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3"
                      >
                        <div
                          className="mb-2 h-12 w-12 rounded-full bg-cover bg-center ring-4 ring-white"
                          style={{ backgroundImage: `url('${student.image}')` }}
                        />
                        <p className="text-sm font-black">
                          #{rank + 1} {student.name}
                        </p>
                        <p className="text-sm font-bold text-cyan-700">
                          {student.percent}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="relative mt-6 h-[200px] overflow-hidden">
              {resultSlides.length > 0 ? (
                resultSlides.map((result, index) => (
                  <div
                    key={result.school}
                    className="absolute inset-0 opacity-0 motion-reduce:animate-none"
                    style={{
                      animation: "school-result-fade 12s infinite",
                      animationDelay: `${index * 4}s`,
                    }}
                  >
                    <div className="mb-3">
                      <p className="text-xs font-bold uppercase text-cyan-700">
                        {result.city}
                      </p>
                      <h3 className="text-lg font-black text-blue-950">
                        {result.school}
                      </h3>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {result.students.map((student, rank) => (
                        <div
                          key={student.studentid}
                          className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3"
                        >
                          <div
                            className="mb-2 h-12 w-12 rounded-full bg-cover bg-center ring-4 ring-white"
                            style={{
                              backgroundImage: `url('${student.image}')`,
                            }}
                          />

                          <p className="text-sm font-black">
                            #{rank + 1} {student.name}
                          </p>

                          <p className="text-sm font-bold text-cyan-700">
                            {student.percent}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-blue-100 bg-blue-50/50 p-5 text-center text-sm text-slate-500">
                  Aucun résultat disponible pour le moment.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PARTENAIRES */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-xl font-black text-blue-950">
            Nos partenaires officiels
          </h2>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {partners.map((partner, index) => (
              <div
                key={`${partner.name}-${index}`}
                className="flex min-w-[120px] flex-col items-center justify-center gap-2"
              >
                {partner.website ? (
                  <Link
                    href={partner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-blue-50 ring-1 ring-blue-100 transition group-hover:scale-110">
                      {partner.logo || partner.image ? (
                        <img
                          src={partner.logo || partner.image}
                          alt={partner.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <School className="h-5 w-5 text-blue-700" />
                      )}
                    </div>
                  </Link>
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-blue-50 ring-1 ring-blue-100">
                    {partner.logo || partner.image ? (
                      <img
                        src={partner.logo || partner.image}
                        alt={partner.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <School className="h-5 w-5 text-blue-700" />
                    )}
                  </div>
                )}

                <div className="text-center leading-tight">
                  <p className="text-xs font-bold text-blue-900">
                    {partner.name}
                  </p>

                  <p className="mt-0.5 text-[10px] font-medium text-blue-500">
                    {partner.type || "Partenaire"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-3xl font-black">Suivez la vie des écoles</h2>
          <p className="mt-3 text-slate-500">
            Photos, annonces, événements, résultats et nouvelles inscriptions.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {socialLinks.map(({ icon: Icon, label, className }) => (
              <Button
                key={label}
                className={`rounded-full px-5 text-white hover:opacity-90 ${className}`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <HomeFooter />
      {/* FOOTER */}
      <footer id="contact" className="hidden">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600">
                <School />
              </div>
              <div>
                <h3 className="text-2xl font-black">Klambocore</h3>
                <p className="text-xs text-blue-200/70">
                  Marketing scolaire RDC
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-blue-100/70">
              Plateforme moderne pour découvrir, promouvoir et digitaliser les
              établissements scolaires en RDC.
            </p>
          </div>

          <div>
            <h4 className="font-black text-white">Services</h4>
            <ul className="mt-5 space-y-3 text-sm text-blue-100/70">
              {[
                ["Établissements", "/etablissements"],
                ["Inscription école", "/inscription-ecole"],
                ["Filières", "/filieres"],
                ["Résultats en ligne", "/resultats"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="relative inline-block transition hover:text-white after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-white after:transition-all after:duration-300 hover:after:w-full"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-black text-white">Entreprise</h4>
            <ul className="mt-5 space-y-3 text-sm text-blue-100/70">
              {[
                ["À propos", "/a-propos"],
                ["Contact", "/contact"],
                ["Support", "/support"],
                ["Partenaires", "/partenaires"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="relative inline-block transition hover:text-white after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-white after:transition-all after:duration-300 hover:after:w-full"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-black text-white">Contact</h4>
            <div className="mt-5 space-y-4 text-sm text-blue-100/70">
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> +243 844 952 966
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> contact@klambocore.com
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Kinshasa, RDC
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-6 text-center text-sm text-blue-100/60 md:flex-row md:items-center md:justify-between md:text-left">
          <p>
            © {new Date().getFullYear()} Klambocore Sarl — Tous droits réservés.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-5 md:justify-end">
            <Link href="/conditions" className="transition hover:text-white">
              Conditions d'utilisation
            </Link>

            <Link
              href="/confidentialite"
              className="transition hover:text-white"
            >
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
