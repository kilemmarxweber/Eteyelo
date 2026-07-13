"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Pencil, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setBranchActiveAction, switchBranchAction } from "./branche.action";
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
  href: string;
  editHref: string;
  isActive: boolean;
  children: React.ReactNode;
}

export function BranchCard({
  branchId,
  href,
  editHref,
  isActive,
  children,
}: BranchCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClick = () => {
    startTransition(async () => {
      await switchBranchAction(branchId);
      router.push(href);
      router.refresh();
    });
  };

  const handleArchive = () => {
    startTransition(async () => {
      const result = await setBranchActiveAction(branchId, !isActive);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Etablissement archive." : "Etablissement reactive.");
      setDialogOpen(false);
      router.refresh();
    });
  };

  return (
    <div
      onClick={handleClick}
      className={`group cursor-pointer ${
        pending ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="relative">
        {children}

        <div
          className="absolute bottom-5 right-5 z-20 flex items-center gap-2"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Button
            asChild
            size="icon"
            variant="outline"
            className="rounded-full"
          >
            <Link href={editHref}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant={isActive ? "destructive" : "outline"} className="rounded-full" title={isActive ? "Archiver" : "Reactiver"}>
                {isActive ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isActive ? "Archiver l'établissement ?" : "Réactiver l'établissement ?"}</DialogTitle>
                <DialogDescription>{isActive ? "L'établissement sera masqué des listes actives, mais toutes ses données et son historique seront conservés." : "L'établissement redeviendra accessible dans les listes actives."}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:space-x-0">
                <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
                <Button variant="outline" onClick={handleArchive} disabled={pending}>
                  {pending && <Loader2 className="mr-2 size-4 animate-spin" />}{isActive ? "Archiver" : "Réactiver"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
