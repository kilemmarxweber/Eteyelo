"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import {
  GraduationCap,
  MapPin,
  ShieldCheck,
  BookOpen,
  CreditCard,
  Users,
  Monitor,
} from "lucide-react";
import Navbar from "@/app/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import HeroSection from "./components/sectionAnimate";
import StudentsSection, {
  type StudentRanking,
} from "./components/sectionResult";

export type HomeBranch = {
  id: string;
  name: string;
  city: string;
  address: string;
  type: string;
  image: string;
  studentsCount: number;
  organizationName: string;
};

export type HomePartnaire = {
  id: string;
  name: string;
  image: string;
  href: string;
  type: string;
  location: string;
  branchName: string | null;
};

type HomePageClientProps = {
  branches: HomeBranch[];
  rankings: StudentRanking[];
  partnaires: HomePartnaire[];
};

export default function HomePageClient({
  branches,
  rankings,
  partnaires,
}: HomePageClientProps) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("Tous");

  const [page, setPage] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const [animatedStats, setAnimatedStats] = useState({
    establishments: 0,
    filieres: 0,
    verifie: 0,
  });

  const ITEMS_PER_PAGE = 3;
  const footerLinkClass =
    "w-fit text-blue-100/80 transition hover:text-white hover:underline hover:underline-offset-4";

  const staticSchools = [
    {
      id: "static-saint-joseph",
      name: "Institut Saint Joseph",
      city: "Kinshasa",
      address: "Av. Lumumba, Gombe",
      type: "Secondaire",
      image:
        "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80",
      studentsCount: 0,
      organizationName: "Klambocore Sarl",
    },
    {
      name: "Université de Kinshasa",
      city: "Kinshasa",
      address: "Lemba",
      type: "Université",
      image: "https://images.unsplash.com/photo-1562774053-701939374585",
    },
    {
      name: "Collège Boboto",
      city: "Kinshasa",
      address: "Gombe",
      type: "Secondaire",
      image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644",
    },
  ] as HomeBranch[];

  const schools = branches;

  const cities = useMemo(() => {
    const branchCities = schools.map((school) => school.city).filter(Boolean);

    return ["Tous", ...Array.from(new Set(branchCities))];
  }, [schools]);

  const filtered = useMemo(() => {
    return schools.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.city.toLowerCase().includes(search.toLowerCase()) ||
        ("organizationName" in s &&
          s.organizationName.toLowerCase().includes(search.toLowerCase()));

      const matchCity = cityFilter === "Tous" || s.city === cityFilter;

      return matchSearch && matchCity;
    });
  }, [schools, search, cityFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const paginatedSchools = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(0);
  }, [search, cityFilter]);

  useEffect(() => {
    if (totalPages <= 1) return;
    if (isHovering) return;

    const interval = setInterval(() => {
      setPage((prev) => (prev + 1) % totalPages);
    }, 5000);

    return () => clearInterval(interval);
  }, [totalPages, isHovering]);

  // =========================
  // STATS ANIMATION
  // =========================
  useEffect(() => {
    const section = document.getElementById("stats-section");
    if (!section) return;

    const targets = {
      establishments: schools.length,
      filieres: schools.reduce(
        (total, school) =>
          total + ("studentsCount" in school ? school.studentsCount : 0),
        0,
      ),
      verifie: 100,
    };

    let interval: ReturnType<typeof setInterval> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;

        if (isVisible) {
          let step = 0;
          const steps = 60;

          interval = setInterval(() => {
            step++;

            const progress = step / steps;

            setAnimatedStats({
              establishments: Math.floor(targets.establishments * progress),
              filieres: Math.floor(targets.filieres * progress),
              verifie: Math.floor(targets.verifie * progress),
            });

            if (step >= steps && interval) {
              clearInterval(interval);
            }
          }, 40);
        } else {
          setAnimatedStats({
            establishments: 0,
            filieres: 0,
            verifie: 0,
          });

          if (interval) {
            clearInterval(interval);
          }
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(section);

    return () => {
      observer.disconnect();

      if (interval) {
        clearInterval(interval);
      }
    };
  }, [schools]);

  const stats = [
    {
      icon: GraduationCap,
      label: "Établissements",
      value: animatedStats.establishments + "+",
    },
    {
      icon: BookOpen,
      label: "Eleves inscrits",
      value: animatedStats.filieres + "+",
    },
    {
      icon: ShieldCheck,
      label: "Vérifié",
      value: animatedStats.verifie + "%",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Navbar />

      <main className="pt-0">
        {/* HERO */}
        <HeroSection
          search={search}
          setSearch={setSearch}
          cities={cities}
          cityFilter={cityFilter}
          setCityFilter={setCityFilter}
        />
        {/* =========================
            STATS PREMIUM SECTION
        ========================= */}
        <section
          id="stats-section"
          className="mx-auto max-w-6xl px-4 mt-14 grid gap-6 md:grid-cols-3"
        >
          {stats.map((s, i) => {
            const Icon = s.icon;

            return (
              <div
                key={i}
                className="
                  relative overflow-hidden rounded-3xl
                  bg-white/70 backdrop-blur-xl
                  border border-white/40
                  shadow-sm
                  transition-all duration-500
                  hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-950/10
                  group
                "
              >
                <div className="absolute -top-16 -right-16 h-40 w-40 bg-blue-950/10 blur-3xl opacity-0 group-hover:opacity-100 transition" />

                <div className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-xl bg-blue-950/10 text-blue-950 flex items-center justify-center">
                      <Icon className="size-5" />
                    </div>
                  </div>

                  <div className="mt-5 text-4xl font-black">{s.value}</div>

                  <p className="text-sm text-gray-500">{s.label}</p>

                  <div className="mt-5 h-[2px] w-0 bg-blue-950 transition-all duration-500 group-hover:w-full" />
                </div>
              </div>
            );
          })}
        </section>
        {/* CARDS */}
        <section
          className="mx-auto max-w-6xl px-4 mt-16"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <h2 className="text-2xl font-bold mb-6">Établissements populaires</h2>

          {paginatedSchools.length ? (
            <div className="grid md:grid-cols-3 gap-6">
              {paginatedSchools.map((school) => (
              <Card
                key={school.id}
                className="
                  relative overflow-hidden rounded-3xl
                  bg-white/80 backdrop-blur-xl
                  border border-gray-100
                  shadow-sm
                  transition-all duration-500
                  hover:-translate-y-3 hover:shadow-2xl hover:rotate-[0.6deg]
                  group
                "
              >
                <div className="relative h-44 overflow-hidden">
                  <Image
                    src={school.image}
                    alt={school.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>

                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="size-4 text-blue-950" />
                    {school.city}
                  </div>

                  <h3 className="font-bold mt-2">{school.name}</h3>

                  <p className="text-sm text-gray-500">{school.address}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-blue-950/10 text-blue-950 px-3 py-1 rounded-full">
                      {school.type}
                    </span>

                    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                      {school.studentsCount} Ã©lÃ¨ve
                      {school.studentsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed bg-white/80 p-8 text-center text-sm text-gray-500">
              Aucune branche active trouvÃ©e pour le moment.
            </div>
          )}
        </section>
        {/* SERVICES */}

        <section className="mx-auto max-w-6xl px-4 mt-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black tracking-tight">
              Solutions informatiques pour écoles
            </h2>

            <p className="text-gray-500 mt-2">
              Digitalisez la gestion de votre établissement
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Gestion scolaire",
                desc: "Notes, bulletins, classes et élèves",
                icon: Monitor,
              },
              {
                title: "Plateforme parents",
                desc: "Suivi des performances en temps réel",
                icon: Users,
              },
              {
                title: "Administration digitale",
                desc: "Paiements, inscriptions et communication",
                icon: CreditCard,
              },
            ].map((s) => {
              const Icon = s.icon;

              return (
                <div
                  key={s.title}
                  className="
            group relative rounded-3xl p-6
            bg-white/70 backdrop-blur-xl
            border border-white/40
            shadow-sm
            transition-all duration-500
            hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-950/10
            overflow-hidden
          "
                >
                  {/* glow background */}
                  <div className="absolute -top-16 -right-16 h-40 w-40 bg-blue-950/10 blur-3xl opacity-0 group-hover:opacity-100 transition" />

                  {/* icon */}
                  <div className="flex items-center justify-between">
                    <div className="h-11 w-11 rounded-2xl bg-blue-950/10 text-blue-950 flex items-center justify-center">
                      <Icon className="size-5" />
                    </div>

                    <div className="h-1 w-10 rounded-full bg-blue-950 opacity-0 transition group-hover:opacity-100" />
                  </div>

                  {/* content */}
                  <h3 className="font-bold text-lg mt-5">{s.title}</h3>

                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    {s.desc}
                  </p>

                  {/* hover bottom line */}
                  <div className="mt-5 h-[2px] w-0 bg-blue-950 transition-all duration-500 group-hover:w-full" />
                </div>
              );
            })}
          </div>
        </section>
        {/* ANALYTICS */}
        <section className="mx-auto max-w-6xl px-4 mt-20">
          <h2 className="text-2xl font-bold mb-6">
            Performance des établissements
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Satisfaction parents */}
            <div className="bg-white border rounded-3xl p-6">
              <h3 className="font-semibold mb-4">Satisfaction des parents</h3>

              <div className="space-y-4">
                {schools.slice(0, 3).map((school) => ({
                  school: school.name,
                  value: Math.min(95, 70 + school.studentsCount * 2),
                })).map((item) => (
                  <div key={item.school}>
                    <div className="flex justify-between text-sm">
                      <span>{item.school}</span>
                      <span>{item.value}%</span>
                    </div>

                    <div className="h-2 bg-gray-100 rounded-full mt-1">
                      <div
                        className="h-2 bg-blue-950 rounded-full"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Réussite élèves */}
            <div className="bg-white border rounded-3xl p-6">
              <h3 className="font-semibold mb-4">Taux de réussite</h3>

              <div className="space-y-4">
                {schools.slice(0, 3).map((school) => ({
                  school: school.name,
                  value: Math.min(98, 68 + school.studentsCount * 2),
                })).map((item) => (
                  <div key={item.school}>
                    <div className="flex justify-between text-sm">
                      <span>{item.school}</span>
                      <span>{item.value}%</span>
                    </div>

                    <div className="h-2 bg-gray-100 rounded-full mt-1">
                      <div
                        className="h-2 bg-blue-950 rounded-full"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        {/* STUDENTS */}
        <StudentsSection rankings={rankings} />
        <section className="mx-auto max-w-6xl px-4 mt-24 overflow-hidden">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-3xl bg-blue-950 flex items-center justify-center shadow-lg">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
            </div>

            <h2 className="text-4xl font-black tracking-tight">
              Ils nous font confiance
            </h2>

            <p className="text-gray-500 mt-3">
              Universités, écoles et institutions partenaires à travers la RDC
            </p>
          </div>

          <div className="relative">
            {/* fade gauche */}
            <div className="absolute left-0 top-0 z-10 h-full w-32 bg-gradient-to-r from-[#f8fafc] to-transparent" />

            {/* fade droite */}
            <div className="absolute right-0 top-0 z-10 h-full w-32 bg-gradient-to-l from-[#f8fafc] to-transparent" />

            <div className="flex gap-8 animate-scroll w-max">
              {partnaires.concat(partnaires).map((partner, index) => (
                <Link
                  key={`${partner.id}-${index}`}
                  href={partner.href}
                  target={partner.href.startsWith("http") ? "_blank" : undefined}
                  rel={partner.href.startsWith("http") ? "noreferrer" : undefined}
                  className="
            group
            min-w-[260px]
            bg-white/80
            backdrop-blur-xl
            border border-white
            rounded-3xl
            p-6
            flex items-center gap-4
            shadow-sm
            transition-all duration-500
            hover:-translate-y-2
            hover:shadow-2xl
            hover:shadow-blue-950/10
          "
                >
                  <div
                    className="
              h-16 w-16
              rounded-2xl
              bg-gray-50
              flex items-center justify-center
              overflow-hidden
              border
            "
                  >
                    <Image
                      src={partner.image}
                      alt={partner.name}
                      width={40}
                      height={40}
                      className="object-contain transition-all duration-500 group-hover:scale-110"
                    />
                  </div>

                  <div>
                    <p className="font-bold text-gray-900">{partner.name}</p>

                    <p className="text-xs text-gray-500 mt-1">
                      {partner.type}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            {!partnaires.length && (
              <div className="rounded-3xl border border-dashed bg-white/80 p-8 text-center text-sm text-gray-500">
                Aucun partenaire actif pour le moment.
              </div>
            )}
          </div>
        </section>
        {/* FOOTER */}
        <footer className="px-4 pb-8 pt-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-blue-950/10 bg-blue-950 text-blue-50 shadow-lg">
            <div className="grid gap-10 p-8 md:grid-cols-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-2 shadow">
                    <GraduationCap className="size-5 text-blue-50" />
                  </div>

                  <div>
                    <h3 className="font-bold text-lg">Klambocore Sarl</h3>
                    <p className="text-xs text-blue-100/80">
                      Marketing scolaire RDC
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-blue-100/80">
                  Plateforme moderne pour découvrir les établissements scolaires
                  en RDC.
                </p>
              </div>

              <div className="text-sm text-blue-100/80">
                <h4 className="mb-4 font-semibold uppercase text-blue-50">Services</h4>
                <div className="flex flex-col items-start gap-3">
                  <Link href="/etablissements" className={footerLinkClass}>Établissements</Link>
                  <Link href="/inscription" className={footerLinkClass}>Inscription école</Link>
                  <Link href="/filieres" className={footerLinkClass}>Filières</Link>
                </div>
              </div>

              <div className="text-sm text-blue-100/80">
                <h4 className="mb-4 font-semibold uppercase text-blue-50">Entreprise</h4>
                <div className="flex flex-col items-start gap-3">
                  <Link href="/about" className={footerLinkClass}>À propos</Link>
                  <Link href="/contact" className={footerLinkClass}>Contact</Link>
                  <Link href="/support" className={footerLinkClass}>Support</Link>
                </div>
              </div>

              <div className="text-sm text-blue-100/80">
                <h4 className="mb-4 font-semibold uppercase text-blue-50">Partenaires</h4>
                <div className="flex flex-col items-start gap-3">
                  <p>Ministère de l'Éducation</p>
                  <p>Universités RDC</p>
                  <p>Instituts privés</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-blue-100/15 px-8 py-5 text-sm text-blue-100/80 md:flex-row md:items-center md:justify-between">
              <p>© 2026 Klambocore Sarl — Tous droits réservés.</p>

              <div className="flex flex-wrap gap-6">
                <Link href="/terms" className={footerLinkClass}>Conditions</Link>
                <Link href="/privacy" className={footerLinkClass}>Confidentialité</Link>
                <Link href="/cookies" className={footerLinkClass}>Cookies</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
