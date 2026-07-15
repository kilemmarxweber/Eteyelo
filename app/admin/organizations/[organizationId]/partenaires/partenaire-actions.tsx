"use client";
import Link from "next/link";
import { Archive, Loader2, Pencil, RotateCcw } from "lucide-react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPartenaireActiveAction } from "./actions";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function PartenaireActions({ id, organizationId, isActive }: { id: string; organizationId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  function toggleStatus() {
    startTransition(async () => {
      const result = await setPartenaireActiveAction(id, !isActive);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(isActive ? "Partenaire desactive." : "Partenaire reactive.");
      setDialogOpen(false);
      router.refresh();
    });
  }
  return <div className="mt-5 flex gap-2 border-t pt-4">
    <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={`/admin/organizations/${organizationId}/partenaires/${id}/edit`}><Pencil className="mr-2 size-4" />Modifier</Link></Button>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild><Button size="sm" variant={isActive ? "destructive" : "outline"} className="rounded-full">
        {isActive ? <Archive className="mr-2 size-4" /> : <RotateCcw className="mr-2 size-4" />}{isActive ? "Désactiver" : "Réactiver"}
      </Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isActive ? "Désactiver le partenaire ?" : "Réactiver le partenaire ?"}</DialogTitle>
          <DialogDescription>{isActive ? "Le partenaire sera masqué des listes actives, mais ses informations seront conservées." : "Le partenaire pourra de nouveau apparaître dans les listes actives."}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0"><DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <Button variant="outline" onClick={toggleStatus} disabled={pending}>{pending && <Loader2 className="mr-2 size-4 animate-spin" />}{isActive ? "Désactiver" : "Réactiver"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
