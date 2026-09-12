"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconBell,
  IconBrandWhatsapp,
  IconDeviceFloppy,
  IconMail,
} from "@tabler/icons-react";
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
  NOTIFICATION_EVENT_META,
  emptyNotificationChannelsMap,
  type NotificationChannelFlags,
  type NotificationChannelsMap,
  type NotificationEvent,
} from "@/lib/notification-channels-shared";
import {
  getNotificationSettingsAction,
  updateNotificationSettingsAction,
} from "../notifications.action";

export default function SettingsNotificationsPage() {
  const pathname = usePathname();
  const [emailMaster, setEmailMaster] = useState(true);
  const [whatsappMaster, setWhatsappMaster] = useState(true);
  const [events, setEvents] = useState<NotificationChannelsMap>(
    emptyNotificationChannelsMap(),
  );
  const [zinduaConnected, setZinduaConnected] = useState<boolean | null>(null);
  const [zinduaStatus, setZinduaStatus] = useState<string | null>(null);
  const [zinduaSetupUrl, setZinduaSetupUrl] = useState<string | null>(null);
  const [envEnabled, setEnvEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const whatsappHref = pathname.replace(/\/notifications\/?$/, "/whatsapp");

  useEffect(() => {
    startTransition(async () => {
      const [data, err] = await getNotificationSettingsAction();
      if (err) {
        toast.error(err.message);
        return;
      }
      if (!data) return;
      setEmailMaster(data.emailMaster);
      setWhatsappMaster(data.whatsappMaster);
      setEvents(data.events);
      setZinduaConnected(data.zindua.connected);
      setZinduaStatus(data.zindua.status);
      setZinduaSetupUrl(data.zindua.setupUrl);
      setEnvEnabled(data.zindua.envEnabled);
      setLoaded(true);
    });
  }, []);

  function setChannel(
    key: NotificationEvent,
    field: keyof NotificationChannelFlags,
    value: boolean,
  ) {
    setEvents((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: key === "emailVerification" && field === "email" ? true : value,
      },
    }));
  }

  function submit() {
    startTransition(async () => {
      const [saved, err] = await updateNotificationSettingsAction({
        emailMaster,
        whatsappMaster,
        events,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (saved) {
        setEmailMaster(saved.emailMaster);
        setWhatsappMaster(saved.whatsappMaster);
        setEvents(saved.events);
        setZinduaConnected(saved.zindua.connected);
        setZinduaStatus(saved.zindua.status);
        setZinduaSetupUrl(saved.zindua.setupUrl);
        setEnvEnabled(saved.zindua.envEnabled);
      }
      toast.success("Préférences de notification enregistrées.");
    });
  }

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Notifications</h2>
            <Badge variant="outline-primary" icon={<IconBell size={14} />}>
              Organisation
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Mail désactivé et WhatsApp activé = WhatsApp seulement, et
            inversement. Les commutateurs maîtres coupent tout le canal. La
            clé API et le QR Zindua restent dans{" "}
            <Link
              href={whatsappHref}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Message WhatsApp
            </Link>
            .
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Canaux maîtres</CardTitle>
            <CardDescription>
              Couper un canal ici ignore les interrupteurs du tableau
              ci-dessous (sauf l&apos;e-mail de vérification de compte).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium">
                  <IconMail className="size-4" />
                  E-mail
                </p>
                <p className="text-sm text-muted-foreground">
                  Désactivé = aucun e-mail scolaire, sauf la confirmation
                  d&apos;adresse.
                </p>
              </div>
              <Switch
                checked={emailMaster}
                disabled={!loaded || pending}
                onCheckedChange={setEmailMaster}
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium">
                  <IconBrandWhatsapp className="size-4" />
                  WhatsApp
                </p>
                <p className="text-sm text-muted-foreground">
                  Même interrupteur que Message WhatsApp. Coupe aussi le .env
                  Zindua.
                </p>
              </div>
              <Switch
                checked={whatsappMaster}
                disabled={!loaded || pending}
                onCheckedChange={setWhatsappMaster}
              />
            </div>
            {loaded && !zinduaConnected ? (
              <div className="rounded-lg border px-4 py-3 text-sm">
                <p>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    WhatsApp Zindua non connecté
                  </span>
                  {zinduaStatus ? ` — statut ${zinduaStatus}.` : "."} Scannez
                  le QR pour délivrer les messages.
                </p>
                {zinduaSetupUrl ? (
                  <a
                    href={zinduaSetupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ouvrir le QR Zindua
                  </a>
                ) : (
                  <Link
                    href={whatsappHref}
                    className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ouvrir Message WhatsApp
                  </Link>
                )}
                {!envEnabled ? (
                  <p className="mt-2 text-amber-700 dark:text-amber-400">
                    L&apos;envoi est aussi coupé dans le .env. Activez WhatsApp
                    et enregistrez.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Par type d&apos;événement</CardTitle>
            <CardDescription>
              Activez Mail, WhatsApp, les deux, ou aucun. Un canal maître
              éteint grise la colonne correspondante.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Événement</th>
                  <th className="w-24 py-2 text-center font-medium">Mail</th>
                  <th className="w-28 py-2 text-center font-medium">
                    WhatsApp
                  </th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENT_META.map((event) => {
                  const row = events[event.key];
                  const emailDisabled =
                    !loaded ||
                    pending ||
                    event.emailForced ||
                    (!emailMaster && !event.emailForced);
                  const whatsappDisabled =
                    !loaded || pending || !whatsappMaster;
                  return (
                    <tr key={event.key} className="border-b last:border-0">
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium">
                          {event.label}
                          {event.comingSoon ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              envoi à venir
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.hint}
                        </p>
                      </td>
                      <td className="py-3 text-center align-middle">
                        <Switch
                          checked={
                            event.emailForced ? true : Boolean(row?.email)
                          }
                          disabled={emailDisabled}
                          onCheckedChange={(checked) =>
                            setChannel(event.key, "email", checked)
                          }
                          aria-label={`Mail — ${event.label}`}
                        />
                      </td>
                      <td className="py-3 text-center align-middle">
                        <Switch
                          checked={Boolean(row?.whatsapp)}
                          disabled={whatsappDisabled}
                          onCheckedChange={(checked) =>
                            setChannel(event.key, "whatsapp", checked)
                          }
                          aria-label={`WhatsApp — ${event.label}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Button type="button" onClick={submit} disabled={!loaded || pending}>
          <IconDeviceFloppy className="mr-2 size-4" />
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
