"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Headphones,
  HelpCircle,
  Mail,
  School,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SUPPORT_TOPICS, type SupportAgentPublic } from "@/lib/support/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/custom/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, normalizeImageSrc } from "@/lib/utils";
import { EstablishmentSupportForm } from "./establishment-support-form";
import {
  MySupportTickets,
  type MySupportTicket,
} from "./my-support-tickets";

const TOPIC_ICONS = [HelpCircle, School, Wrench] as const;

type EstablishmentSupportViewProps = {
  team: SupportAgentPublic[];
  organizationId: string;
  branchId: string;
  myTickets: MySupportTicket[];
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function EstablishmentSupportView({
  team,
  organizationId,
  branchId,
  myTickets,
}: EstablishmentSupportViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedAgentId, setSelectedAgentId] = useState("");

  useEffect(() => {
    if (
      selectedAgentId &&
      !team.some((agent) => agent.id === selectedAgentId)
    ) {
      setSelectedAgentId("");
    }
  }, [selectedAgentId, team]);

  function refreshTickets() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 px-2 sm:px-4 md:px-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium sm:text-xl">Support</h3>
        <p className="text-sm text-muted-foreground">
          Escaladez un souci au support établissement ou directement à
          Klambocore, puis suivez le statut de vos demandes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Comment pouvons-nous vous aider ?
          </CardTitle>
          <CardDescription>
            Choisissez le type de demande qui correspond le mieux à votre
            besoin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {SUPPORT_TOPICS.map((topic, index) => {
              const Icon = TOPIC_ICONS[index] ?? HelpCircle;
              return (
                <div
                  key={topic.title}
                  className="rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <p className="font-medium">{topic.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {topic.text}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {team.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Headphones className="size-5 text-primary" />
              Notre équipe
            </CardTitle>
            <CardDescription>
              Sélectionnez un interlocuteur pour une demande au support
              établissement, ou escaladez directement vers Klambocore.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {team.map((agent) => {
              const isSelected = selectedAgentId === agent.id;

              return (
                <div
                  key={agent.id}
                  className={cn(
                    "flex gap-4 rounded-lg border p-4 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "hover:border-border hover:bg-muted/30",
                  )}
                >
                  <Avatar className="size-14">
                    <AvatarImage
                      src={normalizeImageSrc(agent.image)}
                      alt={agent.name}
                    />
                    <AvatarFallback className="text-sm font-medium">
                      {getInitials(agent.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="font-medium leading-tight">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.role}
                      </p>
                    </div>

                    <a
                      href={`mailto:${agent.email}`}
                      className="inline-flex max-w-full items-center gap-1.5 text-sm text-muted-foreground transition hover:text-primary"
                    >
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{agent.email}</span>
                    </a>

                    {agent.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.topics.map((topic) => (
                          <Badge key={topic} variant="secondary" size="sm">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        document
                          .getElementById("establishment-support-form")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                    >
                      {isSelected
                        ? "Sélectionné"
                        : `Contacter ${agent.name.split(" ")[0]}`}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card id="establishment-support-form">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Escalader une demande
          </CardTitle>
          <CardDescription>
            Décrivez le problème, choisissez le canal (support établissement ou
            Klambocore), puis suivez le statut dans « Mes demandes ».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstablishmentSupportForm
            organizationId={organizationId}
            branchId={branchId}
            supportAgents={team.map(({ id, name, email }) => ({
              id,
              name,
              email,
            }))}
            selectedAgentId={selectedAgentId}
            onAgentChange={setSelectedAgentId}
            onCreated={refreshTickets}
          />
        </CardContent>
      </Card>

      <MySupportTickets tickets={myTickets} />
    </div>
  );
}
