"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { IParent } from "@/src/interfaces/Parent";
import { ParentUpForm } from "./parent-form";

interface UpdateParentDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  onSuccess?: () => void;
  parent: IParent;
}

export function UpdateParentDialog({
  onSuccess,
  parent,
  open,
  onOpenChange,
  ...props
}: UpdateParentDialogProps) {
  const { refresh } = useRefresh();

  const handleUpdated = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Modifier le parent</DialogTitle>
          <DialogDescription>
            Ajustez les informations du parent, puis enregistrez.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <ParentUpForm
            key={parent.id}
            layout="dialog"
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
            onUpdated={handleUpdated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
