"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import type { FicheCentraleIntervention } from "../fichecentrale.action";

type Props = {
  interventions: FicheCentraleIntervention[];
  baseHref: string;
};

export default function InterventionsDetailButton({
  interventions,
  baseHref,
}: Props) {
  if (interventions.length <= 1) return null;

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Eye className="size-3.5" />
          <span className="hidden sm:inline">
            Voir les interventions ({interventions.length})
          </span>
          <span className="sm:hidden">Interventions ({interventions.length})</span>
        </Button>
      </ResponsiveDialogTrigger>

      <ResponsiveDialogContent
        size="md"
        className="flex max-h-[min(90dvh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(85dvh,36rem)]"
      >
        <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-5">
          <ResponsiveDialogTitle>Interventions effectuées</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Détail des {interventions.length} fiches qui composent cette moyenne
            centrale.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {interventions.map((intervention, index) => (
            <div
              key={intervention.id}
              className="rounded-lg border bg-muted/10 px-3 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      Intervention {index + 1}
                    </p>
                    <Badge variant="outline" size="sm">
                      {intervention.typeFiche}
                    </Badge>
                    {intervention.status ? (
                      <StatusBadge status="active" label="Validée" />
                    ) : (
                      <StatusBadge status="pending" label="En attente" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {intervention.teacherName} ·{" "}
                    {new Date(intervention.dateCreated).toLocaleDateString(
                      "fr-FR",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      },
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {intervention.notesCount} note
                    {intervention.notesCount > 1 ? "s" : ""}
                    {intervention.averageScore != null
                      ? ` · moy. ${intervention.averageScore}`
                      : ""}
                  </p>
                </div>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                >
                  <Link href={`${baseHref}/fiches/${intervention.id}`}>
                    Ouvrir
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
