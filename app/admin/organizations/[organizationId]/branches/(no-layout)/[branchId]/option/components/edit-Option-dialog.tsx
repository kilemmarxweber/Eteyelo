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
import { OptionUpForm } from "./option-form";
import { IOption } from "@/src/interfaces/Option";
import type { TrainingLabelKey } from "@/lib/training-labels";

interface UpdateOptionDialogProps extends React.ComponentPropsWithoutRef<
  typeof Sheet
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  option: IOption;
  labelKey?: TrainingLabelKey;
}

export function UpdateOptionDialog({
  showTrigger: _showTrigger = true,
  onSuccess,
  option,
  labelKey = "school",
  open,
  onOpenChange,
  ...props
}: UpdateOptionDialogProps) {
  const tClasses = useTranslations("classes");

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>{tClasses(`option.${labelKey}.editTitle`)}</SheetTitle>
          <SheetDescription>
            {tClasses(`option.${labelKey}.editDesc`)}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <OptionUpForm
            mode="update"
            layout="dialog"
            labelKey={labelKey}
            initialData={{
              id: option.id,
              codeOption: option.codeOption,
              nameOption: option.nameOption,
              sectionId: option.sectionId,
            }}
            onUpdated={onSuccess}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
