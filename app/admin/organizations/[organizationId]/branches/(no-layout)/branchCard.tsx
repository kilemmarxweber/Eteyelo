"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Archive, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteBranchAction, setBranchActiveAction } from "./branche.action";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const actionBtn =
  "size-8 shrink-0 rounded-md border-0 shadow-none sm:size-7";

interface BranchCardProps {
  branchId: string;
  branchName: string;
  enterHref: string;
  editHref: string;
  isActive: boolean;
  canDelete?: boolean;
  children: ReactNode;
}

export function BranchCard({
  enterHref,
  editHref,
  isActive,
  branchId,
  branchName,
  canDelete = true,
  children,
}: BranchCardProps) {
  const router = useRouter();
  const [archivePending, startArchive] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const busy = archivePending || deletePending;

  const handleArchive = () => {
    startArchive(async () => {
      const result = await setBranchActiveAction(branchId, !isActive);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        isActive ? "Établissement archivé." : "Établissement réactivé.",
      );
      setArchiveOpen(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteBranchAction(branchId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Établissement supprimé.");
      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "relative flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card transition hover:border-primary/30 hover:bg-muted/40 hover:shadow-sm",
        busy && "pointer-events-none opacity-50",
      )}
    >
      <Link href={enterHref} className="group block min-w-0 flex-1">
        {children}
      </Link>

      <div
        className={cn(
          "z-20 flex items-center justify-end gap-1 border-t border-border/60 bg-muted/30 px-2.5 py-2",
          "sm:absolute sm:top-1.5 sm:right-1.5 sm:justify-start sm:rounded-lg sm:border sm:border-border/70 sm:bg-background/95 sm:p-0.5 sm:shadow-sm sm:backdrop-blur-sm sm:border-t-0",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Button
          asChild
          size="icon"
          variant="ghost"
          className={cn(
            actionBtn,
            "bg-sky-100 text-sky-700 hover:bg-sky-200 hover:text-sky-800 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900 dark:hover:text-sky-200",
          )}
          title="Modifier"
        >
          <Link href={editHref} aria-label="Modifier">
            <Pencil className="size-3.5" />
          </Link>
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            actionBtn,
            isActive
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900 dark:hover:text-amber-200"
              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900 dark:hover:text-emerald-200",
          )}
          title={isActive ? "Archiver" : "Réactiver"}
          aria-label={isActive ? "Archiver" : "Réactiver"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setArchiveOpen(true);
          }}
        >
          {isActive ? (
            <Archive className="size-3.5" />
          ) : (
            <RotateCcw className="size-3.5" />
          )}
        </Button>

        {canDelete ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className={actionBtn}
            title="Supprimer"
            aria-label="Supprimer"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {isActive
                ? "Archiver l'établissement ?"
                : "Réactiver l'établissement ?"}
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? "L'établissement sera masqué des listes actives, mais toutes ses données et son historique seront conservés."
                : "L'établissement redeviendra accessible dans les listes actives."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveOpen(false)}
              disabled={archivePending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleArchive}
              disabled={archivePending}
              className={cn(
                isActive
                  ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 hover:text-amber-900"
                  : "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 hover:text-emerald-900",
              )}
            >
              {archivePending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {isActive ? "Archiver" : "Réactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canDelete ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Supprimer l&apos;établissement ?</DialogTitle>
              <DialogDescription>
                Cette action est irréversible. L&apos;établissement{" "}
                <span className="font-semibold text-foreground">
                  {branchName}
                </span>
                , ses classes, élèves, parents, enseignants, années scolaires,
                frais, paiements et tout le reste créé pour cette branche
                seront définitivement supprimés.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deletePending}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deletePending}
              >
                {deletePending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                {deletePending ? "Suppression…" : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
