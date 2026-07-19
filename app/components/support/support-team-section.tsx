"use client";

import Image from "next/image";
import { useState } from "react";
import { Headphones, Mail, MessageCircle } from "lucide-react";
import type { SupportAgentPublic } from "@/lib/support/types";
import ContactForm from "@/app/contact/contact-form";
import { Button } from "@/components/ui/button";

type SupportTeamSectionProps = {
  team: SupportAgentPublic[];
  organizationId?: string;
};

export function SupportTeamSection({
  team,
  organizationId,
}: SupportTeamSectionProps) {
  const [selectedAgent, setSelectedAgent] = useState<SupportAgentPublic | null>(
    null,
  );

  return (
    <>
      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Notre equipe
            </p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">
              Des interlocuteurs dedies a votre ecole
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {team.map((agent) => (
            <article
              key={agent.id}
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex flex-col sm:flex-row">
                <div className="relative h-52 w-full shrink-0 sm:h-auto sm:w-44">
                  <Image
                    src={agent.image}
                    alt={`Photo de ${agent.name}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 176px"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {agent.name}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-primary">
                      {agent.role}
                    </p>
                    <a
                      href={`mailto:${agent.email}`}
                      className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
                    >
                      <Mail className="size-4 text-primary" />
                      {agent.email}
                    </a>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {agent.topics.map((topic) => (
                        <li
                          key={topic}
                          className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
                        >
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    type="button"
                    className="mt-5 h-10 w-full rounded-xl"
                    onClick={() => {
                      setSelectedAgent(agent);
                      document
                        .getElementById("support-contact-form")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Contacter {agent.name.split(" ")[0]}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="support-contact-form"
        className="mt-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="rounded-3xl bg-primary p-7 text-primary-foreground shadow-lg shadow-primary/10 md:p-9">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <MessageCircle className="size-4" />
            Formulaire de support
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            Envoyez-nous votre demande
          </h2>

          <p className="mt-4 text-sm leading-7 text-primary-foreground/90">
            Decrivez votre probleme ou votre besoin. Un membre de l&apos;equipe
            support vous repondra rapidement par email.
          </p>

          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-2xl bg-primary-foreground/10 p-4">
              <Headphones className="mt-0.5 size-5 shrink-0" />
              <p>
                Choisissez un interlocuteur ou envoyez votre message a toute
                l&apos;equipe support.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-primary-foreground/10 p-4">
              <Mail className="mt-0.5 size-5 shrink-0" />
              <p>
                Reponse habituelle sous 24 h ouvrables. Pour les urgences,
                precisez-le dans le sujet du message.
              </p>
            </div>
          </div>
        </div>

        <ContactForm
          key={selectedAgent?.id ?? "all"}
          showSupportAgentPicker
          organizationId={organizationId}
          supportAgents={team.map(({ id, name, email }) => ({
            id,
            name,
            email,
          }))}
          supportAgent={selectedAgent?.name}
          recipientEmail={selectedAgent?.email}
        />
      </section>
    </>
  );
}
