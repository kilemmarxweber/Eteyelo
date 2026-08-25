"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ClasseUpForm } from "./classe-form";
import { IClasse } from "@/src/interfaces/Classe";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateClasseDialogProps extends React.ComponentPropsWithoutRef<
  typeof Sheet
> {
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
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>Modifier la classe</SheetTitle>
          <SheetDescription>
            Niveau, filière, vacation et capacité.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {open ? (
            <ClasseUpForm
              key={classe.id}
              mode="update"
              layout="sheet"
              initialData={{
                id: classe.id,
                nameClasse: classe.nameClasse,
                cycle: classe.cycle ?? undefined,
                level: classe.level ?? undefined,
                parallel: classe.parallel ?? undefined,
                capacity: classe.capacity ?? undefined,
                optionId: classe.optionId,
                creneauId: classe.creneauId,
              }}
              onUpdated={handleUpdated}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
