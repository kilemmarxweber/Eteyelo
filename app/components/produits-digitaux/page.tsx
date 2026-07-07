// app/produits-digitaux/page.tsx
import {
  BarChart3,
  GraduationCap,
  School,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { HomeNavbar } from "@/components/home-navbar";
import { HomeFooter } from "@/components/home-footer";
type Props = {};
const products = [
  {
    icon: Users,
    title: "Gestion scolaire",
    text: "Administration des élèves, classes, notes, bulletins, absences et emplois du temps.",
  },
  {
    icon: School,
    title: "Portail Parents",
    text: "Communication, paiements, résultats, annonces et suivi scolaire en temps réel.",
  },
  {
    icon: BarChart3,
    title: "Résultats & Statistiques",
    text: "Classements, performances, meilleurs élèves et tableaux de bord décisionnels.",
  },
  {
    icon: GraduationCap,
    title: "Filières & formations",
    text: "Gestion des options, parcours, inscriptions et orientation scolaire.",
  },
];

export default function DigitalProductsPage(props: Props) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <HomeNavbar />

      <section className="bg-gradient-to-br from-blue-700 to-cyan-500 py-16 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <Badge className="bg-white/20 text-white">Produits digitaux</Badge>
          <h1 className="mt-4 text-4xl font-black">
            Nos solutions informatiques
          </h1>
          <p className="mt-3 max-w-[320] text-blue-50">
            Des outils modernes pour digitaliser la gestion des établissements
            scolaires.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <article
              key={product.title}
              className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <product.icon className="h-7 w-7" />
              </div>

              <h2 className="mt-5 text-xl font-black text-blue-950">
                {product.title}
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {product.text}
              </p>

              <Link
                href="/contact"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
              >
                Demander une démo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}
