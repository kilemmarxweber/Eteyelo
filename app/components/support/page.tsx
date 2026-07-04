import { HomeNavbar } from "@/components/home-navbar";

const supportItems = [
  {
    title: "Assistance compte",
    text: "Aide à la connexion, aux accès administrateurs et à la gestion des utilisateurs.",
  },
  {
    title: "Support établissement",
    text: "Accompagnement pour les classes, élèves, enseignants, paiements et bulletins.",
  },
  {
    title: "Incident technique",
    text: "Analyse des erreurs, lenteurs, imports de données ou problèmes d'affichage.",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-950">
          Support
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          Nous aidons votre équipe à avancer rapidement
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
          Le support Klambocore Sarl accompagne les écoles dans la
          configuration, l'utilisation quotidienne et la résolution des
          incidents.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {supportItems.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <h2 className="font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
