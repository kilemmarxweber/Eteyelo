"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionUpForm } from "./section-form"; // Importez votre formulaire d'éditionimport { ISection } from"@/src/interfaces/Section";
import { ISection } from "@/src/interfaces/Section";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateSectionDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  section: ISection; // Détails de l'élève à éditer
}

export function UpdateSectionDialog({
  showTrigger = true,
  onSuccess,
  section,
  ...props
}: UpdateSectionDialogProps) {
  const [open, setOpen] = React.useState(false);

  const { refresh } = useRefresh();
  const handleUpdate = () => {
    setTimeout(() => {
      refresh(); // Rafraîchir le composant SectionList
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer l'élève</DialogTitle>
          <DialogDescription>
            Modifiez les détails de l'élève ici. Cliquez sur Enregistrer lorsque
            vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <SectionUpForm
          mode="update"
          initialData={{
            id: section.id,
            codeSection: section.codeSection,
            nameSection: section.nameSection,
            statusSection: section.statusSection,
          }} // Pass the section data for editing
          onSectionAction={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
