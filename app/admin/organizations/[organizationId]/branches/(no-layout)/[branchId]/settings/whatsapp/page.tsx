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
  const [baseUrl, setBaseUrl] = useState("https://whatsapp-api.klambocore.com");
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
    if (next === "meta") {
      setApiKey("");
      setSiteUrl("");
      setTemplate(env.template || "notification");
      setBaseUrl(env.baseUrl || "https://whatsapp-api.klambocore.com");
      setFromEnv({ apiKey: true, baseUrl: true });
      setProviderConfigured(Boolean(env.apiKey));
      return;
    }
    setApiKey(env.apiKey);
    setTemplate(env.template || "notification");
    setSiteUrl(env.siteUrl);
    setBaseUrl(env.baseUrl || "https://whatsapp-api.klambocore.com");
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
      setBaseUrl(data.baseUrl || "https://whatsapp-api.klambocore.com");
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
        // Meta : pas de saisie — le serveur ignore et lit le .env
        apiKey: provider === "meta" ? "" : apiKey,
        template,
        siteUrl: provider === "meta" ? "" : siteUrl,
        baseUrl: provider === "meta" ? "" : baseUrl,
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
        setBaseUrl(saved.baseUrl || "https://whatsapp-api.klambocore.com");
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
            <strong>Zindua</strong> / <strong>KlamboWhatsapp</strong> (GOWA) :
            clé saisie ou .env. <strong>Meta</strong> : uniquement le .env (
            <code>MESSAGING_META_API_KEY</code> → projet{" "}
            <code>whatsappProvider=meta</code>).
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
                {provider === "meta" ? (
                  <>
                    Meta lit uniquement le <code>.env</code> :{" "}
                    <code>MESSAGING_META_API_KEY</code> (projet{" "}
                    <code>whatsappProvider=meta</code>) et{" "}
                    <code>MESSAGING_API_BASE_URL</code>. Klambo (GOWA) utilise{" "}
                    <code>MESSAGING_API_KEY</code> (projet{" "}
                    <code>whatsappProvider=gowa</code>).
                  </>
                ) : (
                  <>
                    Actuel : <code>{providerName}</code>. Clé et URL
                    optionnelles : si vides, on lit le <code>.env</code>
                    {provider === "klambo"
                      ? " (MESSAGING_API_KEY + MESSAGING_API_BASE_URL)."
                      : " (ZINDUA_API_KEY)."}
                  </>
                )}
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

            {provider === "meta" ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">Configuration Meta (.env uniquement)</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>
                    <code>MESSAGING_META_API_KEY</code> — clé du projet Klambo
                    avec <code>whatsappProvider=meta</code>
                  </li>
                  <li>
                    <code>MESSAGING_API_BASE_URL</code> — ex.{" "}
                    <code>https://whatsapp-api.klambocore.com</code>
                  </li>
                  <li>
                    <code>MESSAGING_WHATSAPP_TEMPLATE</code> — slug interne
                    (défaut <code>notification</code>)
                  </li>
                </ul>
                <p className="text-muted-foreground">
                  {providerConfigured
                    ? "Clé Meta détectée dans le .env."
                    : "MESSAGING_META_API_KEY manquante dans le .env."}{" "}
                  URL : <code>{baseUrl || "—"}</code>
                </p>
              </div>
            ) : (
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
                    {provider === "klambo"
                      ? "MESSAGING_API_KEY"
                      : "ZINDUA_API_KEY"}
                  </code>
                  .
                </p>
              </div>
            )}

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

              {provider === "meta" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">URL API</p>
                  <p className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-sm">
                    {baseUrl || "MESSAGING_API_BASE_URL"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lecture seule — définie dans le .env.
                  </p>
                </div>
              ) : provider === "zindua" ? (
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
              Envoie un message de vérification via {providerName}. Les envois
              en lot (résultats, horaires…) sont espacés d’environ 14&nbsp;s avec
              jitter aléatoire pour limiter les blocages WhatsApp.
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
