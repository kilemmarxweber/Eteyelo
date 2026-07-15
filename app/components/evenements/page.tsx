// app/evenements/page.tsx
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <HomeNavbar />

      <section className="bg-gradient-to-br from-blue-700 to-cyan-500 py-16 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <Badge className="bg-white/20 text-white">Événements</Badge>
          <h1 className="mt-4 text-4xl font-black">Tous les événements</h1>
          <p className="mt-3 max-w-[320px] text-blue-50">
            Découvrez les activités, cérémonies et annonces des établissements
            partenaires.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <article
              key={event.id}
              className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-blue-100"
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
                <Badge className="bg-blue-100 text-blue-700">
                  <CalendarDays className="mr-1 h-3 w-3" />
                  {formatDate(event.dateStart)}
                </Badge>

                <h2 className="mt-4 text-lg font-black text-blue-950">
                  {event.title || "Événement scolaire"}
                </h2>

                <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <School className="h-4 w-4" />
                  {event.branch.name}
                </p>

                {event.location && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </p>
                )}

                {event.description && (
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                    {event.description}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}
