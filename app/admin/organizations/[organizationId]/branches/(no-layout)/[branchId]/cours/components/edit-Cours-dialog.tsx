"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoursUpForm } from "./cours-form";
import { CoursComponentsPanel } from "./cours-components-panel";
import { ICours } from "@/src/interfaces/Cours";

interface UpdateCoursDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  cours: ICours;
  isPrimary?: boolean;
}

export function UpdateCoursDialog({
  showTrigger = true,
  onSuccess,
  cours,
  isPrimary = false,
  ...props
}: UpdateCoursDialogProps) {
  const t = useTranslations("teaching.courses");
  const handleUpdate = () => {
    onSuccess?.();
  };

  return (
    <Dialog {...props}>
      <DialogContent
        size="lg"
        className="max-h-[min(90dvh,52rem)] gap-4 overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>
            {isPrimary ? t("editDescPrimary") : t("editDescSecondary")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid w-full min-w-0 gap-4">
          <CoursUpForm
            mode="update"
            layout="dialog"
            isPrimary={isPrimary}
            className="w-full min-w-0"
            initialData={{
              id: cours.id,
              codeCours: cours.codeCours,
              nameCours: cours.nameCours,
              description: cours.description,
              primaryDomain: cours.primaryDomain ?? null,
            }}
            onUpdated={handleUpdate}
          />
          <CoursComponentsPanel
            parentCoursId={cours.id}
            parentName={cours.nameCours}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
