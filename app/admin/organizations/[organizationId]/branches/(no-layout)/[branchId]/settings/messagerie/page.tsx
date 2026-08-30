"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconDeviceFloppy, IconMessage } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import {
  getMessagingSettingsAction,
  updateMessagingSettingsAction,
} from "../messagerie.action";

export default function MessagingSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [data, err] = await getMessagingSettingsAction();
      if (err) {
        toast.error(err.message);
        return;
      }
      if (!data) return;
      setEnabled(data.enabled);
      setLoaded(true);
    });
  }, []);

  function submit() {
    startTransition(async () => {
      const [saved, err] = await updateMessagingSettingsAction({ enabled });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (saved) setEnabled(saved.enabled);
      toast.success(
        enabled
          ? "Messagerie interne activée."
          : "Messagerie interne désactivée.",
      );
    });
  }

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Messagerie interne</h2>
            <Badge variant="outline-primary" icon={<IconMessage size={14} />}>
              Organisation
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Active ou désactive les conversations entre les membres des
            établissements de cette organisation.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconMessage className="size-5" />
              Disponibilité
            </CardTitle>
            <CardDescription>
              Désactivée, la messagerie disparaît du menu et plus aucun message
              ne peut être envoyé.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="font-medium">Activer la messagerie</p>
                <p className="text-sm text-muted-foreground">
                  Conversations directes, groupes et notifications internes.
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={!loaded || pending}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              {enabled ? (
                <p>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Messagerie disponible.
                  </span>{" "}
                  Les membres autorisés peuvent écrire et créer des groupes.
                </p>
              ) : (
                <p>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Messagerie coupée.
                  </span>{" "}
                  Le menu et les envois restent bloqués tant que vous
                  n&apos;activez pas le commutateur et n&apos;enregistrez pas.
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={submit}
              disabled={!loaded || pending}
            >
              <IconDeviceFloppy className="mr-2 size-4" />
              {pending ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
