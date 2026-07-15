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
import { deleteFicheIntervention } from "../../ficheCentrales/fichecentrale.action";

type Props = {
  ficheId: string;
  typeFiche: string;
  coursName: string;
};

export default function CancelInterventionButton({
  ficheId,
  typeFiche,
  coursName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (typeFiche === "ficheCote") return null;

  const cancel = () =>
    startTransition(async () => {
      const result = await deleteFicheIntervention({ ficheId });

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
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <XCircle className="size-4" />
          Annuler l&apos;intervention
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler cette intervention ?</DialogTitle>
          <DialogDescription>
            La fiche « {coursName} » ({typeFiche}) et ses notes seront
            définitivement supprimées. Les autres interventions de la fiche
            centrale ne seront pas touchées. Cette action est irréversible.
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
