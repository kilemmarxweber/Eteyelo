"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClasseUpForm } from "./classe-form";
import { IClasse } from "@/src/interfaces/Classe";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateClasseDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  onSuccess?: () => void;
  classe: IClasse;
}

export function UpdateClasseDialog({
  onSuccess,
  classe,
  open,
  onOpenChange,
  ...props
}: UpdateClasseDialogProps) {
  const { refresh } = useRefresh();

  const handleUpdated = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogContent size="lg" className="gap-3">
        <DialogHeader className="space-y-1">
          <DialogTitle>Modifier la classe</DialogTitle>
          <DialogDescription>
            Niveau, filière, vacation et capacité.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <ClasseUpForm
            key={classe.id}
            mode="update"
            initialData={{
              id: classe.id,
              nameClasse: classe.nameClasse,
              level: classe.level ?? undefined,
              parallel: classe.parallel ?? undefined,
              capacity: classe.capacity ?? undefined,
              optionId: classe.optionId,
              creneauId: classe.creneauId,
            }}
            onUpdated={handleUpdated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
