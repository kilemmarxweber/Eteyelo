"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { toast } from "sonner";
import { IconPlus, IconReportMoney } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getTypeFraisSettingsAction } from "../../frais/frais.action";
import { TypeFraisUpForm } from "../../frais/components/type-frais-form";
import type { ITypeFrais } from "@/src/interfaces/Frais";

export default function TypeFraisSettingsPage() {
  const [items, setItems] = useState<ITypeFrais[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<ITypeFrais | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadTypes = useCallback(() => {
    startTransition(async () => {
      const [data, err] = await getTypeFraisSettingsAction();

      if (err) {
        toast.error(err.message);
        return;
      }

      setItems(data);
    });
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const handleSaved = () => {
    setOpenCreate(false);
    setEditing(null);
    loadTypes();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Types de frais</h2>
            <Badge variant="outline-primary" icon={<IconReportMoney size={14} />}>
              Parametres
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Gere les categories utilisees lors de la creation des frais.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <IconPlus size={16} className="mr-2" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un type de frais</DialogTitle>
              <DialogDescription>
                Creez une categorie de frais pour cette branche.
              </DialogDescription>
            </DialogHeader>
            <TypeFraisUpForm mode="create" onCreated={handleSaved} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Statut</th>
              <th className="px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 font-medium">{item.codeType}</td>
                <td className="px-3 py-2">{item.nameType}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {item.description || "-"}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                    {item.statusType ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(item)}
                  >
                    Modifier
                  </Button>
                </td>
              </tr>
            ))}

            {!items.length && (
              <tr>
                <td
                  className="px-3 py-8 text-center text-muted-foreground"
                  colSpan={5}
                >
                  {isPending
                    ? "Chargement..."
                    : "Aucun type de frais configure."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le type de frais</DialogTitle>
            <DialogDescription>
              Mettez a jour le code, le nom ou le statut de ce type.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <TypeFraisUpForm
              mode="update"
              initialData={{
                id: editing.id,
                codeType: editing.codeType,
                nameType: editing.nameType,
                description: editing.description ?? "",
                statusType: editing.statusType,
              }}
              onUpdated={handleSaved}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
