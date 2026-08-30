"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { useRefresh } from "@/src/hooks/RefreshContext";

import { PersonnelUpForm } from "./personnel-form";

interface UpdatePersonnelDialogProps
  extends React.ComponentPropsWithoutRef<typeof Sheet> {
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
  const t = useTranslations("users.staff.table");

  const handleUpdated = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...dialogProps}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>{t("editTitle")}</SheetTitle>
          <SheetDescription>{t("editDescription")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {open ? (
            <PersonnelUpForm
              key={personnel.personnelId ?? personnel.id}
              layout="dialog"
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
                image: personnel.image ?? "",
                orgRole: personnel.role ?? ALL_ORG_ROLE_SLUGS[0],
                cycles: personnel.cycles ?? [],
              }}
              onUpdated={handleUpdated}
              onPersonnelUpdate={handleUpdated}
              onSuccess={handleUpdated}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
