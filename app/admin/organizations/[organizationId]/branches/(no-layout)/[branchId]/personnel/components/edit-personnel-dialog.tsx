"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { useRefresh } from "@/src/hooks/RefreshContext";

import { PersonnelUpForm } from "./personnel-form";

interface UpdatePersonnelDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  onSuccess?: () => void;
  personnel: IPersonnel;
}

export function UpdatePersonnelDialog({
  onSuccess,
  personnel,
  open,
  onOpenChange,
  ...dialogProps
}: UpdatePersonnelDialogProps) {
  const { refresh } = useRefresh();

  const handleUpdate = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...dialogProps}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Modifier le personnel</DialogTitle>
          <DialogDescription>
            Modifiez les détails du personnel, puis enregistrez.
          </DialogDescription>
        </DialogHeader>

        <PersonnelUpForm
          mode="update"
          initialData={{
            personnelId: personnel.personnelId ?? "",
            username: personnel.username ?? "",
            name: personnel.nom,
            prenom: personnel.prenom ?? "",
            postnom: personnel.postnom,
            sexe: personnel.sexe,
            telephone: personnel.telephone ?? "",
            email: personnel.email ?? "",
            dateOfBirth: personnel.dateOfBirth
              ? new Date(personnel.dateOfBirth)
              : new Date(),
            address: personnel.address,
            orgRole: personnel.role ?? ALL_ORG_ROLE_SLUGS[0],
          }}
          onUpdated={handleUpdate}
          onPersonnelUpdate={handleUpdate}
          onSuccess={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
