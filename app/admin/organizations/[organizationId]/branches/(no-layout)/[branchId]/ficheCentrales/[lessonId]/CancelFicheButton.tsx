"use client";

import { useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { deleteFicheCentrale } from "../fichecentrale.action";

type Props = {
  lessonId: string;
  classId: string;
  periodId: number;
  anneeId: string;
  nombreIntervention: number;
  isValidated: boolean;
  listHref: string;
};

export default function CancelFicheButton({
  lessonId,
  classId,
  periodId,
  anneeId,
  nombreIntervention,
  isValidated,
  listHref,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const cancel = () =>
    startTransition(async () => {
      const result = await deleteFicheCentrale({
        lessonId,
        classId,
        periodId,
        anneeId,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      router.push(listHref);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <XCircle className="size-4" />
          Annuler
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler cette fiche centrale ?</DialogTitle>
          <DialogDescription>
            La fiche {isValidated ? "déjà validée" : "en attente"}, sa fiche
            globale et ses {nombreIntervention} intervention
            {nombreIntervention > 1 ? "s" : ""} seront définitivement
            supprimées. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Retour</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={cancel}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirmer l&apos;annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
