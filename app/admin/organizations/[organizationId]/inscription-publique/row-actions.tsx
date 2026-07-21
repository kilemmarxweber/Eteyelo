"use client";

import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteBranchRegistrationInfoAction } from "./actions";

type Props = {
  organizationId: string;
  infoId: string;
};

export function RegistrationInfoRowActions({
  organizationId,
  infoId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = `/admin/organizations/${organizationId}/inscription-publique`;

  function onDelete() {
    if (!window.confirm("Supprimer cette fiche d'inscription publique ?")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteBranchRegistrationInfoAction(
        organizationId,
        infoId,
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`${base}/${infoId}/edit`}>
          <Pencil className="mr-2 size-3.5" />
          Modifier
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={pending}
        onClick={onDelete}
      >
        <Trash2 className="mr-2 size-3.5" />
        Supprimer
      </Button>
    </div>
  );
}
