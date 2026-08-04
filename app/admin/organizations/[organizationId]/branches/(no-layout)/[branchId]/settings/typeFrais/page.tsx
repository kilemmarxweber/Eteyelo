"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { toast } from "sonner";
import { IconPlus, IconReportMoney } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getTypeFraisSettingsAction } from "../../frais/frais.action";
import { TypeFraisUpForm } from "../../frais/components/type-frais-form";
import type { ITypeFrais } from "@/src/interfaces/Frais";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";

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
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Types de frais</h2>
              <Badge
                variant="outline-primary"
                icon={<IconReportMoney size={14} />}
              >
                Paramètres
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Gérez les catégories utilisées lors de la création des frais.
            </p>
          </div>

          <Button type="button" onClick={() => setOpenCreate(true)}>
            <IconPlus size={16} className="mr-2" />
            Ajouter
          </Button>
        </div>

        <Sheet open={openCreate} onOpenChange={setOpenCreate}>
          <SheetContent
            side="right"
            className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          >
            <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
              <SheetTitle>Ajouter un type de frais</SheetTitle>
              <SheetDescription>
                Créez une catégorie de frais pour cette branche.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <TypeFraisUpForm
                mode="create"
                layout="sheet"
                onCreated={handleSaved}
              />
            </div>
          </SheetContent>
        </Sheet>

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
                    <Badge
                      variant={item.statusType ? "default" : "secondary"}
                      className="rounded-full"
                    >
                      {item.statusType ? "Actif" : "Inactif"}
                    </Badge>
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
                      : "Aucun type de frais configuré."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Sheet
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
        >
          <SheetContent
            side="right"
            className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          >
            <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
              <SheetTitle>Modifier le type de frais</SheetTitle>
              <SheetDescription>
                Mettez à jour le nom, la description ou le statut de ce type.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {editing ? (
                <TypeFraisUpForm
                  mode="update"
                  layout="sheet"
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
