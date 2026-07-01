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
import { IFrais } from "@/src/interfaces/Frais";
import { deleteFrais } from "../../frais.action";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { useRouter } from "next/navigation";

interface DeleteFraissDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Frais: Row<IFrais>["original"][];
}

export function DeleteFraissDialog({
  showTrigger = true,
  onSuccess,
  Frais,
  ...props
}: DeleteFraissDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const router = useRouter();
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      for (const frais of Frais) {
        try {
          await deleteFrais({
            id: frais.id,
          });
        } catch (err) {
          toast.error(`Failed to delete frais ${frais.id}: ${err}`);
        }
      }

      onSuccess?.();
      refresh();
      router.refresh();
      props.onOpenChange?.(false);
    });
  };

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconTrash className="mr-2 size-4" aria-hidden="true" />
            Delete ({Frais.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{Frais.length}</span>
            {Frais.length === 1 ? " frai" : " Frais"} from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            aria-label="Delete selected rows"
            variant="destructive"
            onClick={() => {
              toast.success("Fraiss deleted");
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
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
