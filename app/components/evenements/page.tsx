import { CalendarDays, MapPin, School } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HomeNavbar } from "@/components/home-navbar";
import { HomeFooter } from "@/components/home-footer";
import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function EventsPage() {
  const events = await prisma.calendarEvent.findMany({
    where: {
      isArchived: false,
      branch: {
        isActive: true,
      },
    },
    orderBy: { dateStart: "desc" },
    select: {
      id: true,
      title: true,
      image: true,
      dateStart: true,
      location: true,
      description: true,
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <CalendarDays className="size-3.5" />
            Evenements
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Tous les evenements
          </h1>
          <p className="mt-3 max-w-7xl text-sm leading-relaxed text-primary-foreground/90 md:text-base">
            Decouvrez les activites, ceremonies et annonces des etablissements
            partenaires.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <article
              key={event.id}
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:border-primary/30"
            >
              <div
                className="h-52 bg-cover bg-center"
                style={{
                  backgroundImage: `url('${
                    event.image
                      ? normalizeImageSrc(event.image)
                      : "/uploads/galery-1.jpeg"
                  }')`,
                }}
              />

              <div className="p-5">
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  <CalendarDays className="mr-1 size-3" />
                  {formatDate(event.dateStart)}
                </Badge>

                <h2 className="mt-4 text-lg font-bold text-foreground">
                  {event.title || "Evenement scolaire"}
                </h2>

                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <School className="size-4 text-primary" />
                  {event.branch.name}
                </p>

                {event.location ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 text-primary" />
                    {event.location}
                  </p>
                ) : null}

                {event.description ? (
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {event.description}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}
