"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import * as React from "react";
import { IconReload } from "@tabler/icons-react";
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
import { IUser } from "@/src/interfaces/User";
import { resetUserPasswordAction } from "@/app/admin/organizations/[organizationId]/members/actions";

interface ResetUsersDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  email: string;
}

export function ResetUsersDialog({
  showTrigger = true,
  onSuccess,
  email,
  ...props
}: ResetUsersDialogProps) {
  const [isResetPending, startResetTransition] = useTransition();

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconReload className="mr-2 size-4" aria-hidden="true" />
            Réinitialiser
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela reunitialisera le mot de
            passe de l'utilisateur <span className="font-medium">{email}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="reset selected rows"
            variant="destructive"
            onClick={async () => {
              props.onOpenChange?.(false);
              const res = await resetUserPasswordAction({
                email: email,
              });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success("Mot de passe reunitialisé avec success");
              onSuccess?.();
            }}
            disabled={isResetPending}
          >
            {isResetPending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
