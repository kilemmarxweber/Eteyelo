"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { IParent } from "@/src/interfaces/Parent";
import { ParentUpForm } from "./parent-form";

interface UpdateParentDialogProps
  extends React.ComponentPropsWithoutRef<typeof Sheet> {
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
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>Modifier le parent</SheetTitle>
          <SheetDescription>
            Ajustez les informations du parent, puis enregistrez.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
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
                  typeFraisId: parent.discount?.typeFraisId ?? "",
                },
              }}
              onUpdated={handleUpdated}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
