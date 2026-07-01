"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validateFicheCentrale } from "../fichecentrale.action";
import { ShieldCheckIcon } from "lucide-react";

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
      className={
        isValidated
          ? "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400"
          : "bg-green-600/10 text-green-600 hover:bg-green-600/20 focus-visible:ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:hover:bg-green-400/20 dark:focus-visible:ring-green-400/40"
      }
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
      {isPending
        ? "Validation..."
        : isValidated
          ? "Déjà validée"
          : "Valider la fiche"}

      <ShieldCheckIcon />
    </Button>
  );
}
