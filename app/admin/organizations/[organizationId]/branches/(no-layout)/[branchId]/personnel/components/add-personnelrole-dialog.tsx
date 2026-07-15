"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { useRefresh } from "@/src/hooks/RefreshContext";

import { PersonnelRoleUpForm } from "./personnelrole-form";

interface AddPersonnelRoleProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  onSuccess?: () => void;
  personnel: IPersonnel;
}

export function AddPersonnelRole({
  onSuccess,
  personnel,
  open,
  onOpenChange,
  ...props
}: AddPersonnelRoleProps) {
  const { refresh } = useRefresh();

  const handleSuccess = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Assigner un rôle</DialogTitle>
          <DialogDescription>
            Choisissez un rôle pour ce personnel. Les permissions associées
            s&apos;affichent automatiquement.
          </DialogDescription>
        </DialogHeader>

        <PersonnelRoleUpForm
          mode="update"
          initialData={{
            userId: personnel.userId,
            memberId: personnel.memberId,
            personnelId: personnel.personnelId,
            orgRole: personnel.role,
            name: personnel.nom,
            postnom: personnel.postnom,
            prenom: personnel.prenom,
            email: personnel.email,
            telephone: personnel.telephone,
            address: personnel.address,
            sexe: personnel.sexe,
            dateOfBirth: personnel.dateOfBirth,
          }}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange?.(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
