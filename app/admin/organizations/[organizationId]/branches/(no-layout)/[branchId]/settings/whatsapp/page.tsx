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

type ProviderId = "zindua" | "klambo" | "meta";

type EnvDefaults = {
  apiKey: string;
  template: string;
  siteUrl: string;
  baseUrl: string;
};

function providerDisplayName(provider: ProviderId): string {
  if (provider === "meta") return "Meta WhatsApp";
  if (provider === "klambo") return "KlamboWhatsapp";
  return "Zindua";
}

export default function WhatsAppSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState<ProviderId>("zindua");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(true);
  const [template, setTemplate] = useState("notification");
  const [siteUrl, setSiteUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:3001");
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [fromEnv, setFromEnv] = useState({ apiKey: false, baseUrl: false });
  const [envByProvider, setEnvByProvider] = useState<
    Partial<Record<ProviderId, EnvDefaults>>
  >({});
  const [channelConnected, setChannelConnected] = useState<boolean | null>(null);
  const [channelStatus, setChannelStatus] = useState<string | null>(null);
  const [channelSetupUrl, setChannelSetupUrl] = useState<string | null>(null);
  const [channelProject, setChannelProject] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [envEnabled, setEnvEnabled] = useState(true);
  const [testTo, setTestTo] = useState("+243844952966");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const providerName = providerDisplayName(provider);
  const usesKlamboApi = provider === "klambo" || provider === "meta";

  function applyProvider(next: ProviderId) {
    setProvider(next);
    const env = envByProvider[next];
    if (!env) return;
    // Au basculement Meta/Klambo/Zindua : préremplir depuis le .env du provider
    setApiKey(env.apiKey);
    setTemplate(env.template || "notification");
    setSiteUrl(env.siteUrl);
    setBaseUrl(env.baseUrl || "http://localhost:3001");
    setFromEnv({
      apiKey: Boolean(env.apiKey),
      baseUrl: Boolean(env.baseUrl),
    });
    setProviderConfigured(Boolean(env.apiKey));
  }

  useEffect(() => {
    startTransition(async () => {
      const [data, err] = await getWhatsAppSettingsAction();
      if (err) {
        toast.error(err.message);
        return;
      }
      if (!data) return;
      setEnabled(data.enabled);
      setProvider(data.provider);
      setApiKey(data.apiKey);
      setTemplate(data.template);
      setSiteUrl(data.siteUrl);
      setBaseUrl(data.baseUrl || "http://localhost:3001");
      setProviderConfigured(data.providerConfigured);
      setFromEnv(data.fromEnv ?? { apiKey: false, baseUrl: false });
      if (data.envByProvider) setEnvByProvider(data.envByProvider);
      const ch = data.channel ?? data.zindua;
      setChannelConnected(ch.connected);
      setChannelStatus(ch.status);
      setChannelSetupUrl(ch.setupUrl);
      setChannelProject(ch.projectName);
      setChannelError(ch.error ?? null);
      setEnvEnabled(ch.envEnabled);
      setLoaded(true);
    });
  }, []);

  function submit() {
    startTransition(async () => {
      const [saved, err] = await updateWhatsAppSettingsAction({
        enabled,
        provider,
        apiKey,
        template,
        siteUrl,
        baseUrl,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (saved) {
        setEnabled(saved.enabled);
        setProvider(saved.provider);
        setApiKey(saved.apiKey);
        setTemplate(saved.template);
        setSiteUrl(saved.siteUrl);
        setBaseUrl(saved.baseUrl || "http://localhost:3001");
        setProviderConfigured(saved.providerConfigured);
        setFromEnv(saved.fromEnv ?? { apiKey: false, baseUrl: false });
        if (saved.envByProvider) setEnvByProvider(saved.envByProvider);
        const ch = saved.channel ?? saved.zindua;
        setChannelConnected(ch.connected);
        setChannelStatus(ch.status);
        setChannelSetupUrl(ch.setupUrl);
        setChannelProject(ch.projectName);
        setChannelError(ch.error ?? null);
        setEnvEnabled(ch.envEnabled);
      }
      toast.success(
        enabled
          ? `Paramètres WhatsApp enregistrés (${providerDisplayName(provider)}).`
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
            Basculez entre <strong>Zindua</strong>,{" "}
            <strong>KlamboWhatsapp</strong> (GOWA) et{" "}
            <strong>Meta</strong> (Cloud API / templates). Collez la clé API
            du projet correspondant. Les champs vides reprennent le .env.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBrandWhatsapp className="size-5" />
              Fournisseur WhatsApp
            </CardTitle>
            <CardDescription>
              Provider actif, clé API et template. Enregistrez pour appliquer
              (y compris dans le fichier .env).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="font-medium">Activer l’envoi WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Désactivé = aucun message, même si une clé est renseignée.
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={!loaded || pending}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Fournisseur</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={provider === "zindua" ? "default" : "outline"}
                  disabled={!loaded || pending}
                  onClick={() => applyProvider("zindua")}
                >
                  Zindua
                </Button>
                <Button
                  type="button"
                  variant={provider === "klambo" ? "default" : "outline"}
                  disabled={!loaded || pending}
                  onClick={() => applyProvider("klambo")}
                >
                  KlamboWhatsapp
                </Button>
                <Button
                  type="button"
                  variant={provider === "meta" ? "default" : "outline"}
                  disabled={!loaded || pending}
                  onClick={() => applyProvider("meta")}
                >
                  Meta
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Actuel : <code>{providerName}</code>. Clé et URL sont
                optionnelles : si vides, on lit le{" "}
                <code>.env</code>
                {provider === "meta"
                  ? " (MESSAGING_META_API_KEY + MESSAGING_API_BASE_URL)."
                  : provider === "klambo"
                    ? " (MESSAGING_API_KEY + MESSAGING_API_BASE_URL)."
                    : " (ZINDUA_API_KEY)."}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              {!enabled ? (
                <p>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Envoi coupé.
                  </span>{" "}
                  Aucun WhatsApp ne partira tant que le commutateur n’est pas
                  activé et enregistré.
                </p>
              ) : sendingWouldRun || providerConfigured ? (
                <p>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Clé API enregistrée ({providerName}).
                  </span>{" "}
                  {provider === "meta"
                    ? "Les envois passent par des templates Meta approuvés."
                    : channelConnected
                      ? "Les messages WhatsApp partiront avec cette configuration."
                      : "La session WhatsApp doit encore être connectée (QR)."}
                </p>
              ) : (
                <p>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Clé API manquante.
                  </span>{" "}
                  Saisissez une clé ou laissez vide pour utiliser le .env.
                </p>
              )}
            </div>

            {loaded && (
              <div className="rounded-lg border px-4 py-3 text-sm">
                {channelConnected ? (
                  <p>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {provider === "meta"
                        ? `Meta Cloud prêt (${providerName})`
                        : `Session WhatsApp connectée (${providerName})`}
                    </span>
                    {channelProject ? ` — ${channelProject}.` : "."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        WhatsApp non connecté ({providerName})
                      </span>
                      {channelStatus ? ` — statut ${channelStatus}.` : "."}{" "}
                      {provider === "meta"
                        ? "Vérifiez META_* côté API et que le projet utilise whatsappProvider=meta."
                        : "Scannez le QR dans le dashboard du fournisseur."}
                    </p>
                    {channelError ? (
                      <p className="text-muted-foreground">{channelError}</p>
                    ) : null}
                    {channelSetupUrl ? (
                      <a
                        href={channelSetupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Ouvrir {providerName}
                      </a>
                    ) : null}
                    {!envEnabled ? (
                      <p className="text-amber-700 dark:text-amber-400">
                        L’envoi est aussi coupé dans le .env. Activez le
                        commutateur et enregistrez.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="whatsapp-api-key" className="text-sm font-medium">
                Clé API ({providerName})
                {fromEnv.apiKey ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    · depuis .env
                  </span>
                ) : null}
              </label>
              <div className="relative">
                <Input
                  id="whatsapp-api-key"
                  type={showApiKey ? "text" : "password"}
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setFromEnv((prev) => ({ ...prev, apiKey: false }));
                  }}
                  placeholder={
                    usesKlamboApi
                      ? "Vide = .env (sk_test_…)"
                      : "Vide = .env (znd_…)"
                  }
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
                Saisie optionnelle. Sinon :{" "}
                <code>
                  {provider === "meta"
                    ? "MESSAGING_META_API_KEY"
                    : provider === "klambo"
                      ? "MESSAGING_API_KEY"
                      : "ZINDUA_API_KEY"}
                </code>
                {provider === "meta"
                  ? " (projet Klambo avec whatsappProvider=meta)."
                  : "."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="whatsapp-template"
                  className="text-sm font-medium"
                >
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
                  {provider === "meta"
                    ? "Slug interne mappé vers un template Meta approuvé (META_TEMPLATE_MAP)."
                    : <>Corps recommandé : uniquement <code>{"{{code}}"}</code>.</>}
                </p>
              </div>

              {provider === "zindua" ? (
                <div className="space-y-2">
                  <label
                    htmlFor="whatsapp-site-url"
                    className="text-sm font-medium"
                  >
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
                    Si la clé API est liée à un site.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="whatsapp-base-url"
                    className="text-sm font-medium"
                  >
                    URL API KlamboWhatsapp
                    {fromEnv.baseUrl ? (
                      <span className="ml-2 font-normal text-muted-foreground">
                        · depuis .env
                      </span>
                    ) : null}
                  </label>
                  <Input
                    id="whatsapp-base-url"
                    type="url"
                    value={baseUrl}
                    onChange={(event) => {
                      setBaseUrl(event.target.value);
                      setFromEnv((prev) => ({ ...prev, baseUrl: false }));
                    }}
                    placeholder="Vide = MESSAGING_API_BASE_URL"
                    disabled={!loaded || pending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionnel. Sinon{" "}
                    <code>MESSAGING_API_BASE_URL</code> (ex.{" "}
                    <code>https://whatsapp-api.klambocore.com</code>).
                  </p>
                </div>
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

        <Card>
          <CardHeader>
            <CardTitle>Test d’envoi</CardTitle>
            <CardDescription>
              Envoie un message de vérification via {providerName}.
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
