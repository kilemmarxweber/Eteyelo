import { LifeBuoy } from "lucide-react";
import Navbar from "@/app/components/navbar";
import { SUPPORT_TOPICS } from "@/lib/support/types";
import { listActivePlatformSupportAgents } from "@/lib/support/platform-support";
import { SupportTeamSection } from "./support-team-section";

export default async function SupportPage() {
  const team = await listActivePlatformSupportAgents();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-14">
        <section className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1.5 text-xs font-semibold text-blue-950">
            <LifeBuoy className="size-4" />
            Support Kalasa Edu
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Nous aidons votre equipe a avancer rapidement
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
            Le support Klambocore Sarl accompagne les ecoles dans la
            configuration, l&apos;utilisation quotidienne et la resolution des
            incidents. Contactez directement nos referents ou utilisez le
            formulaire ci-dessous.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-950">
            Comment pouvons-nous vous aider ?
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {SUPPORT_TOPICS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {team.length > 0 ? (
          <SupportTeamSection team={team} />
        ) : (
          <p className="mt-14 text-sm text-slate-600">
            L&apos;equipe support plateforme sera bientot disponible. Utilisez
            le formulaire de contact general en attendant.
          </p>
        )}
      </main>
    </div>
  );
}
