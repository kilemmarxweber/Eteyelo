"use client";

import { useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  archiveOrganizationAction,
  restoreOrganizationAction,
} from "@/app/admin/organizations/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ArchiveOrganizationDialogProps = {
  organizationId: string;
  organizationName: string;
  isArchived: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

export function ArchiveOrganizationDialog({
  organizationId,
  organizationName,
  isArchived,
  open,
  onOpenChange,
  onDone,
}: ArchiveOrganizationDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = isArchived
        ? await restoreOrganizationAction(organizationId)
        : await archiveOrganizationAction(organizationId);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        isArchived
          ? "Organisation reactivee."
          : "Organisation archivee.",
      );
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isArchived
              ? "Reactiver l'organisation ?"
              : "Archiver l'organisation ?"}
          </DialogTitle>
          <DialogDescription>
            {isArchived ? (
              <>
                L&apos;organisation{" "}
                <span className="font-semibold text-slate-950">
                  {organizationName}
                </span>{" "}
                redeviendra accessible dans les listes actives.
              </>
            ) : (
              <>
                L&apos;organisation{" "}
                <span className="font-semibold text-slate-950">
                  {organizationName}
                </span>{" "}
                sera masquee des listes actives. Les donnees et l&apos;historique
                sont conserves. Seul un owner plateforme peut la supprimer
                definitivement.
              </>
            )}
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
            variant="outline"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isArchived ? (
              <RotateCcw className="mr-2 size-4" />
            ) : (
              <Archive className="mr-2 size-4" />
            )}
            {isPending
              ? "Traitement..."
              : isArchived
                ? "Reactiver"
                : "Archiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ArchiveOrganizationButtonProps = {
  organizationId: string;
  organizationName: string;
  isArchived?: boolean;
  onDone?: () => void;
  variant?: "icon" | "button";
};

export function ArchiveOrganizationButton({
  organizationId,
  organizationName,
  isArchived = false,
  onDone,
  variant = "icon",
}: ArchiveOrganizationButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "button" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setOpen(true)}
        >
          {isArchived ? (
            <RotateCcw className="mr-2 size-4" />
          ) : (
            <Archive className="mr-2 size-4" />
          )}
          {isArchived ? "Reactiver" : "Archiver"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full text-slate-400 hover:bg-amber-50 hover:text-amber-700"
          aria-label={
            isArchived
              ? `Reactiver ${organizationName}`
              : `Archiver ${organizationName}`
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
        >
          {isArchived ? (
            <RotateCcw className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
        </Button>
      )}

      <ArchiveOrganizationDialog
        organizationId={organizationId}
        organizationName={organizationName}
        isArchived={isArchived}
        open={open}
        onOpenChange={setOpen}
        onDone={onDone}
      />
    </>
  );
}
