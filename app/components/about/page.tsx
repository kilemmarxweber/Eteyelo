import { HomeNavbar } from "@/components/home-navbar";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-950">
          A propos
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          Klambocore Sarl accompagne la digitalisation scolaire
        </h1>

        <div className="mt-8 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border bg-white p-6 text-sm leading-relaxed text-slate-600 shadow-sm">
            <p>
              Klambocore Sarl conçoit des solutions numériques pour aider les
              écoles, instituts et universités à mieux organiser leurs données,
              leurs inscriptions, leurs paiements, leurs résultats et leur
              communication avec les familles.
            </p>

            <p className="mt-4">
              Notre objectif est simple: offrir aux établissements de la RDC une
              plateforme claire, fiable et adaptée à la réalité locale.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-950/10 bg-blue-950 p-6 text-blue-50 shadow-sm">
            <h2 className="text-lg font-semibold">Notre vision</h2>
            <p className="mt-3 text-sm leading-relaxed text-blue-100/80">
              Rendre la gestion scolaire plus rapide, plus transparente et plus
              accessible pour chaque établissement.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
