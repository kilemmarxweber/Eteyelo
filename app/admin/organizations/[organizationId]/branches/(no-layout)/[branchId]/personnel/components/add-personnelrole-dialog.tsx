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
import { PersonnelRoleUpForm } from "./personnelrole-form";
import { IPersonnel } from "@/src/interfaces/Personnel";
type PersonnelFullFormValues = {
  personnelId: string;
  memberId: string;
  userId: string;
  name: string;
  postnom: string;
  prenom: string;
  email: string;
  telephone: string;
  address: string;
  sexe: "masculin" | "feminin";
  dateOfBirth?: Date;
  orgRole: string;
};
interface AddPersonnelRoleProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  personnel: IPersonnel;
}

export function AddPersonnelRole({
  showTrigger = true,
  onSuccess,
  personnel,
  ...props
}: AddPersonnelRoleProps) {
  const [open, setOpen] = React.useState(false);
  const { refresh } = useRefresh();

  const handleUpdate = () => {
    setTimeout(() => {
      console.log("Delayed for 1 second.");
      refresh();
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assigner un rôle</DialogTitle>
          <DialogDescription>
            Modifiez les détails de permission ici. Cliquez sur mettre a jour
            vous êtes prêt.
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
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
