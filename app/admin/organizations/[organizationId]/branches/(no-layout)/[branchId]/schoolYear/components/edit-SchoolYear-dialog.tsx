"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SchoolYearUpForm } from "./SchoolYear-form";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";

interface UpdateSchoolYearDialogProps extends React.ComponentPropsWithoutRef<
  typeof Sheet
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  schoolYear: ISchoolYear;
  branchId: string;
}

export function UpdateSchoolYearDialog({
  showTrigger: _showTrigger = true,
  onSuccess,
  schoolYear,
  branchId,
  open,
  onOpenChange,
  ...props
}: UpdateSchoolYearDialogProps) {
  const { labelLower } = useSchoolYearLabels();
  const { refresh } = useRefresh();

  const handleUpdate = () => {
    refresh();
    onSuccess?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>{`Modifier l'${labelLower}`}</SheetTitle>
          <SheetDescription>
            {`Ajustez le nom et les dates de l'${labelLower}, puis enregistrez.`}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <SchoolYearUpForm
            mode="update"
            layout="dialog"
            initialData={schoolYear}
            onUpdated={handleUpdate}
            branchId={branchId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
