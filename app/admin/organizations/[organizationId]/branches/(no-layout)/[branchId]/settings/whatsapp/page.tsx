"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconBrandWhatsapp, IconDeviceFloppy } from "@tabler/icons-react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  getWhatsAppSettingsAction,
  updateWhatsAppSettingsAction,
} from "../whatsapp.action";

export default function WhatsAppSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(true);
  const [template, setTemplate] = useState("notification");
  const [siteUrl, setSiteUrl] = useState("");
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [data, err] = await getWhatsAppSettingsAction();
      if (err) {
        toast.error(err.message);
        return;
      }
      if (!data) return;
      setEnabled(data.enabled);
      setApiKey(data.apiKey);
      setTemplate(data.template);
      setSiteUrl(data.siteUrl);
      setProviderConfigured(data.providerConfigured);
      setLoaded(true);
    });
  }, []);

  function submit() {
    startTransition(async () => {
      const [saved, err] = await updateWhatsAppSettingsAction({
        enabled,
        apiKey,
        template,
        siteUrl,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (saved) {
        setEnabled(saved.enabled);
        setApiKey(saved.apiKey);
        setTemplate(saved.template);
        setSiteUrl(saved.siteUrl);
        setProviderConfigured(saved.providerConfigured);
      }
      toast.success(
        enabled
          ? "Paramètres WhatsApp enregistrés."
          : "Envoi WhatsApp désactivé (config et .env).",
      );
    });
  }

  const sendingWouldRun = enabled && Boolean(apiKey.trim());

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Message WhatsApp</h2>
            <Badge
              variant="outline-primary"
              icon={<IconBrandWhatsapp size={14} />}
            >
              Organisation
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Toute la configuration Zindua se gère ici. Les champs sont
            préremplis depuis le .env ; un champ vide reprend le .env. Si
            l’envoi est désactivé, rien ne part (le .env est aussi coupé).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBrandWhatsapp className="size-5" />
              Fournisseur Zindua
            </CardTitle>
            <CardDescription>
              Clé API, template et URL du site. Enregistrez pour appliquer, y
              compris dans le fichier .env.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="font-medium">Activer l’envoi WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Désactivé = aucun message, aucune file, même si une clé est
                  renseignée ici ou dans le .env.
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={!loaded || pending}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              {!enabled ? (
                <p>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Envoi coupé.
                  </span>{" "}
                  Aucun WhatsApp ne sera envoyé tant que vous n’activez pas le
                  commutateur et n’enregistrez pas.
                </p>
              ) : sendingWouldRun || providerConfigured ? (
                <p>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Prêt à envoyer.
                  </span>{" "}
                  Les messages WhatsApp partiront avec cette configuration.
                </p>
              ) : (
                <p>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Clé API manquante.
                  </span>{" "}
                  Saisissez une clé ou laissez le champ vide pour utiliser le
                  .env.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="whatsapp-api-key" className="text-sm font-medium">
                Clé API Zindua
              </label>
              <div className="relative">
                <Input
                  id="whatsapp-api-key"
                  type={showApiKey ? "text" : "password"}
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="znd_live_…"
                  disabled={!loaded || pending}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((value) => !value)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={
                    showApiKey ? "Masquer la clé API" : "Afficher la clé API"
                  }
                >
                  {showApiKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Préremplie depuis le .env. Vide = repli sur{" "}
                <code>ZINDUA_API_KEY</code>.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="whatsapp-template" className="text-sm font-medium">
                  Template WhatsApp
                </label>
                <Input
                  id="whatsapp-template"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                  placeholder="notification"
                  disabled={!loaded || pending}
                />
                <p className="text-xs text-muted-foreground">
                  Slug Zindua. Le corps du template doit être uniquement{" "}
                  <code>{"{{code}}"}</code>.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="whatsapp-site-url" className="text-sm font-medium">
                  URL du site (Zindua)
                </label>
                <Input
                  id="whatsapp-site-url"
                  type="url"
                  value={siteUrl}
                  onChange={(event) => setSiteUrl(event.target.value)}
                  placeholder="https://klambocore.com"
                  disabled={!loaded || pending}
                />
                <p className="text-xs text-muted-foreground">
                  Obligatoire si la clé API est liée à un site.
                </p>
              </div>
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
