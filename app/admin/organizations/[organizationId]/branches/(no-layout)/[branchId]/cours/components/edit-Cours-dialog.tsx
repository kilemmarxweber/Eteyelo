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
import { ATELIER_LINK_PERIOD_AUTO } from "@/lib/atelier-course-link-shared";

interface UpdateCoursDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  cours: ICours;
  isPrimary?: boolean;
  isAtelier?: boolean;
}

export function UpdateCoursDialog({
  showTrigger = true,
  onSuccess,
  cours,
  isPrimary = false,
  isAtelier = false,
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
            {isPrimary
              ? t("editDescPrimary")
              : isAtelier
                ? t("editDescAtelier")
                : t("editDescSecondary")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid w-full min-w-0 gap-4">
          <CoursUpForm
            mode="update"
            layout="dialog"
            isPrimary={isPrimary}
            isAtelier={isAtelier}
            className="w-full min-w-0"
            initialData={{
              id: cours.id,
              codeCours: cours.codeCours,
              nameCours: cours.nameCours,
              description: cours.description,
              primaryDomain: cours.primaryDomain ?? null,
              linkedSecondaryBranchId:
                cours.atelierLink?.secondaryBranchId ?? null,
              linkedSecondaryCoursId:
                cours.atelierLink?.secondaryCoursId ?? null,
              linkedTargetPeriodKey: cours.atelierLink
                ? ATELIER_LINK_PERIOD_AUTO
                : null,
              practicalDomainId: cours.practicalDomainId ?? null,
            }}
            onUpdated={handleUpdate}
          />
          {!isAtelier ? (
            <CoursComponentsPanel
              parentCoursId={cours.id}
              parentName={cours.nameCours}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
