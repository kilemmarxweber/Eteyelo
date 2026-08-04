"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FraisUpForm } from "./frais-form";
import { IFrais } from "@/src/interfaces/Frais";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateFraisDialogProps extends React.ComponentPropsWithoutRef<
  typeof Sheet
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  frais: IFrais;
}

export function UpdateFraisDialog({
  showTrigger: _showTrigger = true,
  onSuccess,
  frais,
  open,
  onOpenChange,
  ...props
}: UpdateFraisDialogProps) {
  const { refresh } = useRefresh();

  const handleUpdate = () => {
    refresh();
    onOpenChange?.(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>Modifier le frais</SheetTitle>
          <SheetDescription>
            Mettez à jour le montant, le type ou l&apos;échéance, puis
            enregistrez.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <FraisUpForm
            mode="update"
            layout="dialog"
            initialData={{
              id: frais.id,
              montantFrais: frais.montantFrais,
              nameFrais: frais.nameFrais,
              statusFrais: frais.statusFrais,
              classeId: frais.classeId || "",
              typeFraisId: frais.typeFraisId || "",
              echeance: frais.echeance,
              priority: frais.priority,
            }}
            onUpdated={handleUpdate}
            onSuccess={onSuccess}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
