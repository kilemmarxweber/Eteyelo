"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useSession } from "@/lib/auth-client";
import {
  IconClipboardList,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { canAccessSchoolOpsSettings } from "@/lib/auth/session-roles";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import {
  deleteBranchRegistrationInfoAction,
  listBranchRegistrationInfosAction,
  type BranchRegistrationInfoListItem,
} from "../inscription-publique.action";
import { BranchRegistrationSettingsForm } from "./branch-registration-settings-form";
import type { BranchRegistrationInfoFormValues } from "@/app/admin/organizations/[organizationId]/inscription-publique/schema";

type SchoolYearOption = {
  id: string;
  nameYear: string;
  isCurrentYear: boolean;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InscriptionPubliqueSettingsPage() {
  const { data: session } = useSession();
  const canManage = canAccessSchoolOpsSettings(session);
  const [, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [currentSchoolYearId, setCurrentSchoolYearId] = useState("");
  const [items, setItems] = useState<BranchRegistrationInfoListItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] =
    useState<BranchRegistrationInfoListItem | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listBranchRegistrationInfosAction();
      setBranchId(data.branchId);
      setSchoolYears(data.schoolYears);
      setCurrentSchoolYearId(data.currentSchoolYearId);
      setItems(data.items);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Chargement impossible.",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: BranchRegistrationInfoListItem) {
    setEditing(item);
    setFormOpen(true);
  }

  function closeForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditing(null);
  }

  function handleSuccess() {
    setFormOpen(false);
    setEditing(null);
    void load();
  }

  function deleteItem(item: BranchRegistrationInfoListItem) {
    startTransition(async () => {
      const result = await deleteBranchRegistrationInfoAction({ id: item.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      await load();
    });
  }

  const createDefaults: Partial<BranchRegistrationInfoFormValues> = {
    branchId,
    schoolYearId: currentSchoolYearId,
    isPublished: false,
    termsTitle: "Conditions d'inscription",
    termsContent: "",
    registrationFeeRequired: true,
    registrationFeeAmount: "",
    registrationFeeCurrency: "CDF",
    registrationFeeLabel: "Frais d'inscription",
    registrationFeeDueNote:
      "A regler aupres de la caisse avant la confirmation du dossier.",
    rentreeProgram: [],
  };

  return (
    <RequireBranchOrgSettingsAccess level="school_ops">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Communication publique</h2>
            <Badge
              variant="outline-primary"
              icon={<IconClipboardList size={14} />}
            >
              Inscription
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Conditions, frais et programme de rentree affiches sur /inscription
            apres le choix de cette ecole.
          </p>
        </div>

        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:flex-row sm:items-center sm:justify-between">
          {canManage ? (
            <Button type="button" className="self-start" onClick={openCreate}>
              <IconPlus className="mr-2 size-4" />
              Ajouter une fiche
            </Button>
          ) : (
            <div className="hidden min-h-9 sm:block" aria-hidden />
          )}
          <p className="text-xs text-muted-foreground sm:text-sm">
            {items.length} fiche{items.length === 1 ? "" : "s"}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {loading ? (
              "Chargement..."
            ) : (
              <div className="space-y-3">
                <p>
                  Aucune fiche. Ajoutez les infos d&apos;inscription pour une
                  annee scolaire.
                </p>
                {canManage ? (
                  <Button type="button" onClick={openCreate}>
                    <IconPlus className="mr-2 size-4" />
                    Ajouter une fiche
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">
                      {item.termsTitle || "Sans titre"}
                    </h3>
                    {item.isPublished ? (
                      <Badge variant="secondary">Publiee</Badge>
                    ) : (
                      <Badge variant="outline">Brouillon</Badge>
                    )}
                    {item.schoolYearName ? (
                      <Badge variant="outline">{item.schoolYearName}</Badge>
                    ) : (
                      <Badge variant="outline">Sans annee</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mis a jour {formatUpdatedAt(item.updatedAt)}
                    {item.registrationFeeRequired && item.registrationFeeAmount
                      ? ` · Frais ${item.registrationFeeAmount} ${item.registrationFeeCurrency}`
                      : " · Sans frais signales"}
                    {item.rentreeCount
                      ? ` · ${item.rentreeCount} etape${item.rentreeCount > 1 ? "s" : ""} de rentree`
                      : ""}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(item)}
                    >
                      <IconPencil className="mr-1 size-4" />
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteItem(item)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <Sheet open={formOpen} onOpenChange={closeForm}>
          <SheetContent
            side="right"
            className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          >
            <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
              <SheetTitle>
                {editing
                  ? "Modifier la fiche publique"
                  : "Ajouter une fiche publique"}
              </SheetTitle>
              <SheetDescription>
                Ces informations apparaissent sur /inscription pour
                l&apos;annee scolaire choisie.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {branchId ? (
                <BranchRegistrationSettingsForm
                  key={editing?.id ?? "create"}
                  branchId={branchId}
                  schoolYears={schoolYears}
                  initialValues={
                    editing ? editing.formValues : createDefaults
                  }
                  onSuccess={handleSuccess}
                  onCancel={() => closeForm(false)}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
