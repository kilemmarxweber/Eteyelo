"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, GraduationCap, Mail, Phone } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";

import { ITeacher } from "@/src/interfaces/Teacher";
import { ITeaching } from "@/src/interfaces/Teaching";
import { getTeachingByTeacherAction } from "../../teaching/teaching.action";
import { getSchedulesByTeacherAction } from "../../schedule/schedule.action";

/* =========================
   DAYS FIXE
========================= */
const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

type HoraireJour = {
  classe: string;
  cours: string;
  heure: string;
  day: string;
};

interface Props {
  teacher: ITeacher;
}

export function CarteEnseignantComplete({ teacher }: Props) {
  const [teaching, setTeaching] = useState<ITeaching[]>([]);
  const [schedules, setSchedules] = useState<HoraireJour[]>([]);
  const [loading, setLoading] = useState(true);

  /* =========================
     TEACHING
  ========================= */
  useEffect(() => {
    async function fetchTeaching() {
      const [data] = await getTeachingByTeacherAction({
        teacherId: teacher.id,
      });

      if (data) setTeaching(data);
    }

    fetchTeaching();
  }, [teacher.id]);

  /* =========================
     SCHEDULES
  ========================= */
  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true);

      const [data, error] = await getSchedulesByTeacherAction({
        teacherId: teacher.id,
      });

      if (!error && Array.isArray(data)) {
        setSchedules(
          data.map((s) => ({
            day: s.day,
            classe: s.classe?.nameClasse || "—",
            cours: s.cours?.nameCours || "—",
            heure: s.hour || "—",
          })),
        );
      } else {
        setSchedules([]);
      }

      setLoading(false);
    }

    fetchSchedules();
  }, [teacher.id]);

  /* =========================
     GROUP BY DAY
  ========================= */
  const grouped = DAYS.reduce(
    (acc, day) => {
      acc[day] = schedules.filter((s) => s.day === day);
      return acc;
    },
    {} as Record<string, HoraireJour[]>,
  );

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <ScrollArea className="h-[600px] w-full rounded-md border">
        {/* HEADER (tu gardes ton design) */}
        <CardHeader className="bg-muted/50 p-6 gap-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
            <Avatar className="h-24 w-24">
              <AvatarFallback>{teacher.nom?.[0]}</AvatarFallback>
            </Avatar>

            <div className="text-center sm:text-left">
              <CardTitle className="text-2xl font-semibold text-primary">
                {`${teacher.prenom} ${teacher.nom} ${teacher.postnom}`.toUpperCase()}
              </CardTitle>

              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <Mail className="inline w-4 h-4 mr-1" />
                  <Link href={`mailto:${teacher.email}`}>{teacher.email}</Link>
                </div>

                <div>
                  <Phone className="inline w-4 h-4 mr-1" />
                  <Link href={`tel:${teacher.telephone}`}>
                    {teacher.telephone}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 mt-3">
          <Accordion type="single" collapsible>
            {/* ================= COURS ================= */}
            <AccordionItem value="cours">
              <AccordionTrigger>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <GraduationCap className="h-5 w-5" />
                  Cours dispensés
                </h3>
              </AccordionTrigger>

              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {teaching.length > 0 ? (
                    teaching.map((t, i) => (
                      <Badge key={i} variant="secondary">
                        {t.nameCours} ({t.codeClasse})
                      </Badge>
                    ))
                  ) : (
                    <div>Aucun cours</div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ================= EMPLOI DU TEMPS ================= */}
            <AccordionItem value="schedule">
              <AccordionTrigger>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <CalendarDays className="h-5 w-5" />
                  Emploi du temps complet
                </h3>
              </AccordionTrigger>

              <AccordionContent>
                {loading ? (
                  <div>Chargement...</div>
                ) : (
                  <div className="space-y-4">
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="border rounded-lg p-3 bg-muted/20"
                      >
                        <div className="font-bold mb-2">{day}</div>

                        {grouped[day].length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Aucun cours
                          </p>
                        ) : (
                          <ScrollArea className="max-h-[180px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Classe</TableHead>
                                  <TableHead>Cours</TableHead>
                                  <TableHead>Heure</TableHead>
                                </TableRow>
                              </TableHeader>

                              <TableBody>
                                {grouped[day].map((h, i) => (
                                  <TableRow key={i}>
                                    <TableCell>{h.classe}</TableCell>
                                    <TableCell>{h.cours}</TableCell>
                                    <TableCell className="font-semibold text-primary">
                                      {h.heure}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
