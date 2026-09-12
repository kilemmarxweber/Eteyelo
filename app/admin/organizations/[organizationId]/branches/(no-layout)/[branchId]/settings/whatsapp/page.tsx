"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconBrandWhatsapp, IconDeviceFloppy, IconSend } from "@tabler/icons-react";
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
  sendWhatsAppTestAction,
  updateWhatsAppSettingsAction,
} from "../whatsapp.action";

export default function WhatsAppSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(true);
  const [template, setTemplate] = useState("notification");
  const [siteUrl, setSiteUrl] = useState("");
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [zinduaConnected, setZinduaConnected] = useState<boolean | null>(null);
  const [zinduaStatus, setZinduaStatus] = useState<string | null>(null);
  const [zinduaSetupUrl, setZinduaSetupUrl] = useState<string | null>(null);
  const [zinduaProject, setZinduaProject] = useState<string | null>(null);
  const [zinduaError, setZinduaError] = useState<string | null>(null);
  const [envEnabled, setEnvEnabled] = useState(true);
  const [testTo, setTestTo] = useState("+243844952966");
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
      setZinduaConnected(data.zindua.connected);
      setZinduaStatus(data.zindua.status);
      setZinduaSetupUrl(data.zindua.setupUrl);
      setZinduaProject(data.zindua.projectName);
      setZinduaError(data.zindua.error ?? null);
      setEnvEnabled(data.zindua.envEnabled);
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
        setZinduaConnected(saved.zindua.connected);
        setZinduaStatus(saved.zindua.status);
        setZinduaSetupUrl(saved.zindua.setupUrl);
        setZinduaProject(saved.zindua.projectName);
        setZinduaError(saved.zindua.error ?? null);
        setEnvEnabled(saved.zindua.envEnabled);
      }
      toast.success(
        enabled
          ? "Paramètres WhatsApp enregistrés."
          : "Envoi WhatsApp désactivé (config et .env).",
      );
    });
  }

  function sendTest() {
    startTransition(async () => {
      const [ok, err] = await sendWhatsAppTestAction({ to: testTo });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (ok) {
        toast.success(`Message de test envoyé à ${testTo}.`);
      }
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
            l’envoi est désactivé, rien ne part (le .env est aussi coupé). Mail
            ou WhatsApp par type d’événement : Paramètres → Notifications.
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
                    Clé API enregistrée.
                  </span>{" "}
                  {zinduaConnected
                    ? "Les messages WhatsApp partiront avec cette configuration."
                    : "La session WhatsApp Zindua doit encore être connectée (QR)."}
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

            {loaded && (
              <div className="rounded-lg border px-4 py-3 text-sm">
                {zinduaConnected ? (
                  <p>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      Session WhatsApp Zindua connectée
                    </span>
                    {zinduaProject ? ` (${zinduaProject}).` : "."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        WhatsApp Zindua non connecté
                      </span>
                      {zinduaStatus ? ` — statut ${zinduaStatus}.` : "."}{" "}
                      La clé API est valide, mais aucun numéro n’est lié. Scannez
                      le QR dans le dashboard.
                    </p>
                    {zinduaError ? (
                      <p className="text-muted-foreground">{zinduaError}</p>
                    ) : null}
                    {zinduaSetupUrl ? (
                      <a
                        href={zinduaSetupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Ouvrir le QR Zindua
                      </a>
                    ) : null}
                    {!envEnabled ? (
                      <p className="text-amber-700 dark:text-amber-400">
                        L’envoi est aussi coupé dans le .env
                        (ZINDUA_WHATSAPP_ENABLED=false). Activez le commutateur
                        et enregistrez.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

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

        <Card>
          <CardHeader>
            <CardTitle>Test d’envoi</CardTitle>
            <CardDescription>
              Envoie un message de vérification via Zindua, sans réinitialiser
              de mot de passe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="whatsapp-test-to" className="text-sm font-medium">
                Numéro (E.164)
              </label>
              <Input
                id="whatsapp-test-to"
                value={testTo}
                onChange={(event) => setTestTo(event.target.value)}
                placeholder="+243844952966"
                disabled={!loaded || pending}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={sendTest}
              disabled={!loaded || pending || !testTo.trim()}
            >
              <IconSend className="mr-2 size-4" />
              {pending ? "Envoi..." : "Envoyer un test"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
