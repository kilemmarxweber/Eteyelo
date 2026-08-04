"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { RegistrationExtraInfoFields } from "@/components/registration-extra-info-fields";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  emptyFamilyExtraInfo,
  emptyStudentExtraInfo,
  type FamilyExtraInfo,
  type StudentExtraInfo,
} from "@/lib/registration-extra-info";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  initialStudent?: StudentExtraInfo;
  initialFamily?: FamilyExtraInfo;
  hideFamily?: boolean;
  onSave: (payload: {
    studentExtra: StudentExtraInfo;
    familyExtra: FamilyExtraInfo;
  }) => Promise<{ ok: boolean; message?: string }>;
};

export function RegistrationExtraInfoSheet({
  open,
  onOpenChange,
  title = "Autres informations",
  description = "Ces champs sont optionnels. Vous pouvez les compléter plus tard.",
  initialStudent,
  initialFamily,
  hideFamily = false,
  onSave,
}: Props) {
  const [studentExtra, setStudentExtra] = useState(
    initialStudent ?? emptyStudentExtraInfo(),
  );
  const [familyExtra, setFamilyExtra] = useState(
    initialFamily ?? emptyFamilyExtraInfo(),
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setStudentExtra(initialStudent ?? emptyStudentExtraInfo());
    setFamilyExtra(initialFamily ?? emptyFamilyExtraInfo());
  }, [open, initialStudent, initialFamily]);

  function handleSave() {
    startTransition(async () => {
      const result = await onSave({ studentExtra, familyExtra });
      if (!result.ok) {
        toast.error(result.message ?? "Enregistrement impossible.");
        return;
      }
      toast.success(result.message ?? "Informations enregistrées.");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,28rem)] max-w-full flex-col gap-0 overflow-hidden p-0"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-4 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6">
          <RegistrationExtraInfoFields
            className="w-full min-w-0 max-w-full space-y-5 [&_input]:max-w-full"
            studentExtra={studentExtra}
            familyExtra={familyExtra}
            hideFamily={hideFamily}
            onStudentChange={(key, value) =>
              setStudentExtra((current) => ({ ...current, [key]: value }))
            }
            onFamilyChange={(key, value) =>
              setFamilyExtra((current) => ({ ...current, [key]: value }))
            }
          />
        </div>

        <SheetFooter className="mt-auto shrink-0 flex-col gap-2 border-t bg-background px-4 py-4 sm:flex-row sm:justify-end sm:space-x-0 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Enregistrer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
