"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ParentUpForm } from "./parent-form"; // Importez votre formulaire d'éditionimport { IParent } from"@/src/interfaces/Parent";
import { IParent } from "@/src/interfaces/Parent";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateParentDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  parent: IParent; // Détails de l'parent à éditer
}

export function UpdateParentDialog({
  showTrigger = true,
  onSuccess,
  parent,
  ...props
}: UpdateParentDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { refresh } = useRefresh();

  const handleUpdate = () => {
    setTimeout(() => {
      console.log("Delayed for 1 second.");
      refresh(); // Rafraîchir le composant UserList
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Éditer l'parent</DialogTitle>
          <DialogDescription>
            Modifiez les détails de l'parent ici. Cliquez sur Enregistrer
            lorsque vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <ParentUpForm
          mode="update"
          initialData={{
            parentId: parent.id,
            username: parent.username ?? "",
            name: parent.nom ?? "",
            prenom: parent.prenom ?? "",
            postnom: parent.postnom ?? "",
            sexe: parent.sexe ?? "",
            telephone: parent.telephone ?? "",
            email: parent.email ?? "",
            address: parent.address ?? "",
            dateOfBirth: parent.dateOfBirth ?? "",
            discount: {
              scope: parent.discount?.scope ?? "PARENT",
              percentage: parent.discount?.percentage ?? 0,
              minChildren: parent.discount?.minChildren ?? 0,
            },
          }}
          onParentCreated={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
