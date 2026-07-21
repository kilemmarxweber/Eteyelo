"use client";

import Image from "next/image";
import { MapPin, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import type { StudentAnnouncementsData } from "@/lib/student-announcements-types";

type StudentAnnouncementsSectionProps = {
  announcements: StudentAnnouncementsData;
};

const CARD_ACCENTS = [
  "border-sky-200 bg-sky-50/70",
  "border-violet-200 bg-violet-50/70",
  "border-amber-200 bg-amber-50/70",
  "border-emerald-200 bg-emerald-50/70",
];

export function StudentAnnouncementsSection({
  announcements,
}: StudentAnnouncementsSectionProps) {
  const peopleLabels = useBranchPeopleLabels();
  const { items } = announcements;

  return (
    <Card className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Megaphone className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Annonces de l&apos;ecole</h3>
          <p className="text-xs text-muted-foreground">
            Annonces generales et annonces de la classe de {peopleLabels.studentDefinite}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune annonce disponible pour cet {peopleLabels.studentLower}.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <article
              key={item.id}
              className={cn(
                "overflow-hidden rounded-xl border p-4",
                CARD_ACCENTS[index % CARD_ACCENTS.length],
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-foreground">{item.title}</h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full text-[11px]",
                        item.audienceScope === "all"
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-violet-300 bg-violet-100 text-violet-700",
                      )}
                    >
                      {item.audienceLabel}
                    </Badge>
                    {item.eventTypeName ? (
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        {item.eventTypeName}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Publie le {item.dateStartLabel}
                    {item.dateEndLabel ? ` · jusqu'au ${item.dateEndLabel}` : ""}
                  </p>

                  {item.description ? (
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {item.description}
                    </p>
                  ) : null}

                  {item.location ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      {item.location}
                    </p>
                  ) : null}
                </div>

                {item.image ? (
                  <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg border bg-white sm:h-20 sm:w-32">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
