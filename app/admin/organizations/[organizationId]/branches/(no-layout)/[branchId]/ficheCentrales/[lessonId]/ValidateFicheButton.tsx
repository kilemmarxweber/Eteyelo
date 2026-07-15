"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validateFicheCentrale } from "../fichecentrale.action";
import { Loader2, ShieldCheck } from "lucide-react";

type Props = {
  lessonId: string;
  classId: string;
  periodId: number;
  anneeId: string;
  disabled?: boolean;
  isValidated?: boolean;
};

export default function ValidateFicheButton({
  lessonId,
  classId,
  periodId,
  anneeId,
  disabled = false,
  isValidated = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={isValidated ? "outline" : "default"}
      className="gap-1.5"
      disabled={disabled || isPending || isValidated}
      onClick={() =>
        startTransition(async () => {
          const result = await validateFicheCentrale({
            lessonId,
            classId,
            periodId,
            anneeId,
          });

          if (!result.success) {
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
          router.refresh();
        })
      }
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ShieldCheck className="size-4" />
      )}
      {isPending
        ? "Validation…"
        : isValidated
          ? "Déjà validée"
          : "Valider la fiche"}
    </Button>
  );
}
