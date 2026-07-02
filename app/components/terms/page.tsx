import Navbar from "@/app/components/navbar";

const sections = [
  {
    title: "1. Utilisation du service",
    text: "La plateforme doit être utilisée pour la gestion scolaire, la consultation d'établissements et les services numériques associés.",
  },
  {
    title: "2. Comptes utilisateurs",
    text: "Chaque utilisateur est responsable de la confidentialité de ses accès et des actions effectuées depuis son compte.",
  },
  {
    title: "3. Données scolaires",
    text: "Les établissements restent responsables de l'exactitude des informations, résultats, inscriptions et paiements enregistrés.",
  },
  {
    title: "4. Evolution du service",
    text: "Klambocore Sarl peut améliorer ou modifier la plateforme afin de renforcer la sécurité, la performance et la qualité du service.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-950">
          Conditions
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          Conditions d'utilisation
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          En utilisant les services de Klambocore Sarl, vous acceptez ces
          conditions d'utilisation.
        </p>

        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {section.text}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
