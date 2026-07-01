"use client";

import * as React from "react";
import { IconReload, IconTrash } from "@tabler/icons-react";
import { type Row } from "@tanstack/react-table";
import { toast } from "sonner";

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
import { ICreneau } from "@/src/interfaces/creneau";
import { deleteCreneauAction } from "../creneau.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteCreneausDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Creneaus: Row<ICreneau>["original"][];
}

export function DeleteCreneausDialog({
  showTrigger = true,
  onSuccess,
  Creneaus,
  ...props
}: DeleteCreneausDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      for (const creneau of Creneaus) {
        try {
          await deleteCreneauAction(creneau);
        } catch (err) {
          toast.error(
            `erreur lors de la suppression de la vacation ${creneau.id}: ${err}`
          );
        }
      }

      onSuccess?.();
      setTimeout(() => {
        console.log("Component refreshed");
        refresh();
      }, 1000);
    });
  };

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconTrash className="mr-2 size-4" aria-hidden="true" />
            Suppresion ({Creneaus.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{Creneaus.length}</span>
            {Creneaus.length === 1 ? " vacation" : " vacations"} from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Delete selected rows"
            variant="destructive"
            onClick={() => {
              props.onOpenChange?.(false);
              toast.success("Creneaus deleted");
              onSuccess?.();
              handleDelete();
            }}
            disabled={isDeletePending}
          >
            {isDeletePending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
