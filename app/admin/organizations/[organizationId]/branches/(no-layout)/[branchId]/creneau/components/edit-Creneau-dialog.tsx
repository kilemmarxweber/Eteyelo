"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreneauUpForm } from "./creneau-form";
import { ICreneau } from "@/src/interfaces/creneau";

interface UpdateCreneauDialogProps extends React.ComponentPropsWithoutRef<
  typeof Sheet
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  creneau: ICreneau;
}

export function UpdateCreneauDialog({
  showTrigger: _showTrigger = true,
  onSuccess,
  creneau,
  open,
  onOpenChange,
  ...props
}: UpdateCreneauDialogProps) {
  const handleUpdate = () => {
    onSuccess?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>Modifier la vacation</SheetTitle>
          <SheetDescription>
            Mettez à jour les horaires, la durée des cours et la récréation.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <CreneauUpForm
            mode="update"
            layout="dialog"
            initialData={creneau}
            onUpdated={handleUpdate}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
