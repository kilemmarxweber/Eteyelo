"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconClockHour4, IconExternalLink, IconPlus } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreneauUpForm } from "../../creneau/components/creneau-form";
import CreneauList from "../../creneau/components/CreneausTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";

export default function HorairesSettingsPage() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh();
  const vacationHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/creneau`;
  const scheduleHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/schedule`;

  function handleCreated() {
    refresh();
    setOpen(false);
  }

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Structure des horaires</h2>
              <Badge
                variant="outline-primary"
                icon={<IconClockHour4 size={14} />}
              >
                Paramètres
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Définissez les périodes et la récréation de chaque vacation. Au
              secondaire / humanités, le modèle courant est 3 cours avant et 3
              après une récréation de 15 minutes. Le primaire peut utiliser une
              autre structure.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={scheduleHref}>
                <IconExternalLink className="mr-2 size-4" />
                Ouvrir les horaires
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={vacationHref}>
                <IconExternalLink className="mr-2 size-4" />
                Page Vacations
              </Link>
            </Button>
            <Button type="button" onClick={() => setOpen(true)}>
              <IconPlus className="mr-2 size-4" />
              Ajouter une vacation
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Comment ça marche</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Créez une vacation (matin / après-midi) avec ses périodes.</li>
            <li>Assignez cette vacation à chaque classe concernée.</li>
            <li>
              Planifiez ensuite les cours dans Horaire, en cliquant sur la grille
              du lundi au samedi.
            </li>
          </ol>
        </div>

        <CreneauList refreshKey={String(refreshKey)} />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Nouvelle vacation</DialogTitle>
              <DialogDescription>
                Choisissez un modèle (secondaire ou primaire) puis ajustez si
                besoin.
              </DialogDescription>
            </DialogHeader>
            <CreneauUpForm
              key={open ? "settings-creneau-open" : "settings-creneau-closed"}
              mode="create"
              onCreated={handleCreated}
            />
          </DialogContent>
        </Dialog>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
