"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Archive, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteBranchAction, setBranchActiveAction } from "./branche.action";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BranchCardProps {
  branchId: string;
  branchName: string;
  enterHref: string;
  editHref: string;
  isActive: boolean;
  extraActions?: ReactNode;
  children: ReactNode;
}

export function BranchCard({
  enterHref,
  editHref,
  isActive,
  branchId,
  branchName,
  extraActions,
  children,
}: BranchCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleArchive = () => {
    startTransition(async () => {
      const result = await setBranchActiveAction(branchId, !isActive);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Etablissement archive." : "Etablissement reactive.");
      setArchiveOpen(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteBranchAction(branchId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Etablissement supprime.");
      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="relative min-w-0 w-full">
      <Link
        href={enterHref}
        className={`group block h-full cursor-pointer ${
          pending ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {children}
      </Link>

      <div
        className="absolute top-1.5 right-1.5 z-20 flex flex-nowrap items-center gap-1"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Button
          asChild
          size="icon"
          variant="outline"
          className="size-7 shrink-0 rounded-md"
        >
          <Link href={editHref}>
            <Pencil className="size-3.5" />
          </Link>
        </Button>
        {extraActions}

        <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant={isActive ? "destructive" : "outline"}
              className="size-7 shrink-0 rounded-md"
              title={isActive ? "Archiver" : "Reactiver"}
            >
              {isActive ? (
                <Archive className="size-3.5" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isActive ? "Archiver l'établissement ?" : "Réactiver l'établissement ?"}
              </DialogTitle>
              <DialogDescription>
                {isActive
                  ? "L'établissement sera masqué des listes actives, mais toutes ses données et son historique seront conservés."
                  : "L'établissement redeviendra accessible dans les listes actives."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:space-x-0">
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button variant="outline" onClick={handleArchive} disabled={pending}>
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isActive ? "Archiver" : "Réactiver"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="destructive"
              className="size-7 shrink-0 rounded-md"
              title="Supprimer"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer l&apos;établissement ?</DialogTitle>
              <DialogDescription>
                Cette action est irréversible. L&apos;établissement{" "}
                <span className="font-semibold text-foreground">{branchName}</span>
                , ses classes, élèves, parents, enseignants, années scolaires,
                frais, paiements et tout le reste créé pour cette branche seront
                définitivement supprimés.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:space-x-0">
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Trash2 className="mr-2 size-4" />
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
