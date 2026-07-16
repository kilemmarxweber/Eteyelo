"use client";

import { useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteOrganizationAction } from "@/app/admin/organizations/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteOrganizationDialogProps = {
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  redirectTo?: string;
};

export function DeleteOrganizationDialog({
  organizationId,
  organizationName,
  open,
  onOpenChange,
  onDeleted,
  redirectTo = "/admin/organizations",
}: DeleteOrganizationDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteOrganizationAction(organizationId);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Organisation supprimee.");
      onOpenChange(false);
      onDeleted?.();
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer l&apos;organisation</DialogTitle>
          <DialogDescription>
            Cette action est irreversible. L&apos;organisation{" "}
            <span className="font-semibold text-foreground">
              {organizationName}
            </span>{" "}
            et toutes ses donnees associees seront supprimees.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="mr-2 size-4" />
            {isPending ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DeleteOrganizationButtonProps = {
  organizationId: string;
  organizationName: string;
  onDeleted?: () => void;
  redirectTo?: string;
  variant?: "icon" | "button";
};

export function DeleteOrganizationButton({
  organizationId,
  organizationName,
  onDeleted,
  redirectTo,
  variant = "icon",
}: DeleteOrganizationButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "button" ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="rounded-full"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="mr-2 size-4" />
          Supprimer
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"
          aria-label={`Supprimer ${organizationName}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      )}

      <DeleteOrganizationDialog
        organizationId={organizationId}
        organizationName={organizationName}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted}
        redirectTo={redirectTo}
      />
    </>
  );
}
