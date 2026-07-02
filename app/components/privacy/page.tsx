import Navbar from "@/app/components/navbar";

const sections = [
  {
    title: "1. Données collectées",
    text: "Nous pouvons traiter des informations liées aux comptes, établissements, élèves, enseignants, paiements et échanges de support.",
  },
  {
    title: "2. Utilisation des données",
    text: "Ces données servent à fournir les fonctionnalités scolaires, sécuriser les accès, assister les utilisateurs et améliorer le service.",
  },
  {
    title: "3. Partage des données",
    text: "Klambocore Sarl ne vend pas les données. Le partage est limité aux besoins techniques, légaux ou opérationnels du service.",
  },
  {
    title: "4. Sécurité",
    text: "Nous appliquons des mesures de protection pour limiter les accès non autorisés et préserver l'intégrité des informations.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-950">
          Confidentialite
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          Politique de confidentialité
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Cette politique explique comment Klambocore Sarl protège et utilise les
          informations nécessaires au fonctionnement de la plateforme.
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
