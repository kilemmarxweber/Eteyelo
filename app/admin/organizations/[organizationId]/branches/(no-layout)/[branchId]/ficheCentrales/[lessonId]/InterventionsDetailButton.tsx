"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  deleteFicheIntervention,
  type FicheCentraleIntervention,
} from "../fichecentrale.action";

type Props = {
  interventions: FicheCentraleIntervention[];
  baseHref: string;
};

function CancelInterventionRowButton({
  intervention,
  index,
}: {
  intervention: FicheCentraleIntervention;
  index: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const cancel = () =>
    startTransition(async () => {
      const result = await deleteFicheIntervention({
        ficheId: intervention.id,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      router.push(result.redirectTo);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full shrink-0 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
        >
          <Trash2 className="size-3.5" />
          Supprimer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Supprimer l&apos;intervention {index + 1} ?
          </DialogTitle>
          <DialogDescription>
            La fiche « {intervention.typeFiche} » et ses notes seront
            définitivement supprimées. Les autres interventions ne seront pas
            touchées. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Retour</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={cancel}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
            centrale. Vous pouvez ouvrir ou supprimer chaque intervention.
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

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
                  <CancelInterventionRowButton
                    intervention={intervention}
                    index={index}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
