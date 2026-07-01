"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
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
import StudentsSection from "./components/sectionResult";
const partners = [
  {
    name: "Google",
    logo: "https://cdn.simpleicons.org/google",
  },
  {
    name: "Microsoft",
    logo: "https://cdn.simpleicons.org/microsoft",
  },
  {
    name: "Orange",
    logo: "https://cdn.simpleicons.org/orange",
  },
  {
    name: "Airtel",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Airtel_logo.svg",
  },
  {
    name: "UNICEF",
    logo: "https://cdn.simpleicons.org/unicef",
  },
  {
    name: "UNESCO",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/92/UNESCO_logo.svg",
  },
  {
    name: "Vercel",
    logo: "https://cdn.simpleicons.org/vercel",
  },
  {
    name: "GitHub",
    logo: "https://cdn.simpleicons.org/github",
  },
];
export default function HomePage() {
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

  const schools = [
    {
      name: "Institut Saint Joseph",
      city: "Kinshasa",
      address: "Av. Lumumba, Gombe",
      type: "Secondaire",
      image:
        "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80",
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
  ];

  const cities = ["Tous", "Kinshasa", "Goma", "Lubumbashi"];

  const filtered = useMemo(() => {
    return schools.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.city.toLowerCase().includes(search.toLowerCase());

      const matchCity = cityFilter === "Tous" || s.city === cityFilter;

      return matchSearch && matchCity;
    });
  }, [search, cityFilter]);

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
      establishments: 200,
      filieres: 50,
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
  }, []);

  const stats = [
    {
      icon: GraduationCap,
      label: "Établissements",
      value: animatedStats.establishments + "+",
    },
    {
      icon: BookOpen,
      label: "Filières",
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
                  hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10
                  group
                "
              >
                <div className="absolute -top-16 -right-16 h-40 w-40 bg-blue-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition" />

                <div className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon className="size-5" />
                    </div>
                  </div>

                  <div className="mt-5 text-4xl font-black">{s.value}</div>

                  <p className="text-sm text-gray-500">{s.label}</p>

                  <div className="mt-5 h-[2px] w-0 bg-blue-500 transition-all duration-500 group-hover:w-full" />
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

          <div className="grid md:grid-cols-3 gap-6">
            {paginatedSchools.map((school) => (
              <Card
                key={school.name}
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
                <div className="h-44 overflow-hidden">
                  <img
                    src={school.image}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>

                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="size-4 text-blue-600" />
                    {school.city}
                  </div>

                  <h3 className="font-bold mt-2">{school.name}</h3>

                  <p className="text-sm text-gray-500">{school.address}</p>

                  <div className="mt-3 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full inline-block">
                    {school.type}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
            hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10
            overflow-hidden
          "
                >
                  {/* glow background */}
                  <div className="absolute -top-16 -right-16 h-40 w-40 bg-blue-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition" />

                  {/* icon */}
                  <div className="flex items-center justify-between">
                    <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon className="size-5" />
                    </div>

                    <div className="h-1 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition" />
                  </div>

                  {/* content */}
                  <h3 className="font-bold text-lg mt-5">{s.title}</h3>

                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    {s.desc}
                  </p>

                  {/* hover bottom line */}
                  <div className="mt-5 h-[2px] w-0 bg-blue-600 transition-all duration-500 group-hover:w-full" />
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
                {[
                  { school: "UNIKIN", value: 85 },
                  { school: "Boboto", value: 72 },
                  { school: "Saint Joseph", value: 90 },
                ].map((item) => (
                  <div key={item.school}>
                    <div className="flex justify-between text-sm">
                      <span>{item.school}</span>
                      <span>{item.value}%</span>
                    </div>

                    <div className="h-2 bg-gray-100 rounded-full mt-1">
                      <div
                        className="h-2 bg-blue-600 rounded-full"
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
                {[
                  { school: "UNIKIN", value: 78 },
                  { school: "Boboto", value: 65 },
                  { school: "Saint Joseph", value: 88 },
                ].map((item) => (
                  <div key={item.school}>
                    <div className="flex justify-between text-sm">
                      <span>{item.school}</span>
                      <span>{item.value}%</span>
                    </div>

                    <div className="h-2 bg-gray-100 rounded-full mt-1">
                      <div
                        className="h-2 bg-green-600 rounded-full"
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
        <StudentsSection />
        <section className="mx-auto max-w-6xl px-4 mt-24 overflow-hidden">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-lg">
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
              {partners.concat(partners).map((partner, index) => (
                <div
                  key={index}
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
            hover:shadow-blue-500/10
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
                    <img
                      src={partner.logo}
                      alt={partner.name}
                      className="
  h-10 w-10 object-contain
  transition-all duration-500
  group-hover:scale-110
"
                    />
                  </div>

                  <div>
                    <p className="font-bold text-gray-900">{partner.name}</p>

                    <p className="text-xs text-gray-500 mt-1">
                      Partenaire officiel
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* FOOTER */}
        <footer className="px-4 pb-8 pt-6">
          <div className="mx-auto max-w-6xl rounded-3xl border bg-background/70 backdrop-blur-xl shadow-lg overflow-hidden">
            <div className="grid gap-10 p-8 md:grid-cols-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary p-2 shadow">
                    <GraduationCap className="size-5 text-primary-foreground" />
                  </div>

                  <div>
                    <h3 className="font-bold text-lg">Kalasa Edu</h3>
                    <p className="text-xs text-muted-foreground">
                      Marketing scolaire RDC
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  Plateforme moderne pour découvrir les établissements scolaires
                  en RDC.
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <h4 className="mb-4 font-semibold uppercase">Services</h4>
                <div className="space-y-3">
                  <Link href="/etablissements">Établissements</Link>
                  <Link href="/inscription">Inscription école</Link>
                  <Link href="/filieres">Filières</Link>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <h4 className="mb-4 font-semibold uppercase">Entreprise</h4>
                <div className="space-y-3">
                  <Link href="/about">À propos</Link>
                  <Link href="/contact">Contact</Link>
                  <Link href="/support">Support</Link>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <h4 className="mb-4 font-semibold uppercase">Partenaires</h4>
                <p>Ministère de l'Éducation</p>
                <p>Universités RDC</p>
                <p>Instituts privés</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t px-8 py-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <p>© 2026 Kalasa Edu — Tous droits réservés.</p>

              <div className="flex gap-6">
                <Link href="/terms">Conditions</Link>
                <Link href="/privacy">Confidentialité</Link>
                <Link href="/cookies">Cookies</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
