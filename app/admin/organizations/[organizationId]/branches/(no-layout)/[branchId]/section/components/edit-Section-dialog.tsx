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
import { SectionUpForm } from "./section-form";
import { ISection } from "@/src/interfaces/Section";
import type { TrainingLabelKey } from "@/lib/training-labels";

interface UpdateSectionDialogProps extends React.ComponentPropsWithoutRef<
  typeof Sheet
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  section: ISection;
  labelKey?: TrainingLabelKey;
}

export function UpdateSectionDialog({
  showTrigger: _showTrigger = true,
  onSuccess,
  section,
  labelKey = "school",
  open,
  onOpenChange,
  ...props
}: UpdateSectionDialogProps) {
  const tClasses = useTranslations("classes");

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>{tClasses(`section.${labelKey}.editTitle`)}</SheetTitle>
          <SheetDescription>
            {tClasses(`section.${labelKey}.editDesc`)}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <SectionUpForm
            mode="update"
            layout="dialog"
            labelKey={labelKey}
            initialData={{
              id: section.id,
              codeSection: section.codeSection,
              nameSection: section.nameSection,
              statusSection: section.statusSection,
            }}
            onUpdated={onSuccess}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
