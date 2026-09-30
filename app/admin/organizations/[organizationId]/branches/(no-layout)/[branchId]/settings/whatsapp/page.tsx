"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconBrandWhatsapp,
  IconDeviceFloppy,
  IconSend,
} from "@tabler/icons-react";
import { Eye, EyeOff, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ProviderId = "inbox" | "zindua" | "klambo" | "meta";

type EnvDefaults = {
  apiKey: string;
  template: string;
  siteUrl: string;
  baseUrl: string;
};

function providerDisplayName(provider: ProviderId): string {
  if (provider === "inbox") return "Klambo Inbox";
  if (provider === "meta") return "Meta WhatsApp";
  if (provider === "klambo") return "KlamboWhatsapp";
  return "Zindua";
}

export default function WhatsAppSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState<ProviderId>("inbox");
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
  const isInbox = provider === "inbox";
  const usesKlamboApi = provider === "klambo" || provider === "meta";

  function applyProvider(next: ProviderId) {
    setProvider(next);
    setEnabled(next !== "inbox");
    if (next === "inbox") {
      setApiKey("");
      setSiteUrl("");
      setFromEnv({ apiKey: false, baseUrl: false });
      setProviderConfigured(true);
      return;
    }
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
        enabled: provider !== "inbox",
        provider,
        apiKey: provider === "meta" || provider === "inbox" ? "" : apiKey,
        template,
        siteUrl: provider === "meta" || provider === "inbox" ? "" : siteUrl,
        baseUrl: provider === "meta" || provider === "inbox" ? "" : baseUrl,
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
        `Canal actif : ${providerDisplayName(provider)} (les autres sont coupés).`,
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

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Notifications & messagerie</h2>
            <Badge
              variant="outline-primary"
              icon={<IconBrandWhatsapp size={14} />}
            >
              Organisation
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Un seul canal à la fois pour ménager les ressources :{" "}
            <strong>Klambo Inbox</strong>, <strong>Zindua</strong>,{" "}
            <strong>KlamboWhatsapp</strong> ou <strong>Meta</strong>.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBrandWhatsapp className="size-5" />
              Canal de notification
            </CardTitle>
            <CardDescription>
              Activer un canal désactive automatiquement les trois autres.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Canal actif</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={provider === "inbox" ? "default" : "outline"}
                  disabled={!loaded || pending}
                  onClick={() => applyProvider("inbox")}
                >
                  <Inbox className="mr-1.5 size-4" />
                  Klambo Inbox
                </Button>
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
                  KlamboWhatsapp (API)
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
                {isInbox ? (
                  <>
                    Alertes école uniquement dans l’inbox de l’app Klambo (OTP).
                    Aucun envoi WhatsApp / gateway.
                  </>
                ) : provider === "meta" ? (
                  <>
                    Meta lit uniquement le <code>.env</code> :{" "}
                    <code>MESSAGING_META_API_KEY</code> et{" "}
                    <code>MESSAGING_API_BASE_URL</code>. Inbox app désactivée.
                  </>
                ) : (
                  <>
                    Gateway <code>{providerName}</code> uniquement — inbox app
                    coupée. Clé / URL optionnelles : sinon lecture du{" "}
                    <code>.env</code>
                    {provider === "klambo"
                      ? " (MESSAGING_API_KEY + MESSAGING_API_BASE_URL)."
                      : " (ZINDUA_API_KEY)."}
                  </>
                )}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              {isInbox ? (
                <p>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Klambo Inbox actif.
                  </span>{" "}
                  Zindua, KlamboWhatsapp et Meta sont désactivés.
                </p>
              ) : sendingWouldRunHint(enabled, apiKey, providerConfigured) ? (
                <p>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Gateway {providerName} actif.
                  </span>{" "}
                  {provider === "meta"
                    ? "Templates Meta approuvés. Inbox Klambo coupée."
                    : channelConnected
                      ? "WhatsApp prêt. Inbox Klambo coupée."
                      : "Session WhatsApp à connecter (QR). Inbox Klambo coupée."}
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

            {loaded && !isInbox && (
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
                        L’envoi est aussi coupé dans le .env.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {isInbox ? (
              <div className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm">
                <p className="font-medium text-emerald-800 dark:text-emerald-300">
                  Configuration Klambo Inbox
                </p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>
                    Destinataire joignable : compte app + membre de
                    l’organisation
                  </li>
                  <li>Messagerie organisation activée</li>
                  <li>Pas de clé API gateway requise</li>
                </ul>
              </div>
            ) : provider === "meta" ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">Configuration Meta (.env uniquement)</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>
                    <code>MESSAGING_META_API_KEY</code> — projet{" "}
                    <code>whatsappProvider=meta</code>
                  </li>
                  <li>
                    <code>MESSAGING_API_BASE_URL</code>
                  </li>
                  <li>
                    <code>MESSAGING_WHATSAPP_TEMPLATE</code>
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

            {!isInbox && (
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
                      ? "Slug interne mappé vers un template Meta approuvé."
                      : (
                          <>
                            Corps recommandé : uniquement{" "}
                            <code>{"{{code}}"}</code>.
                          </>
                        )}
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
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              onClick={submit}
              disabled={!loaded || pending}
            >
              <IconDeviceFloppy className="mr-2 size-4" />
              {pending ? "Enregistrement..." : "Enregistrer le canal"}
            </Button>
          </CardContent>
        </Card>

        {!isInbox && (
          <Card>
            <CardHeader>
              <CardTitle>Test d’envoi</CardTitle>
              <CardDescription>
                Envoie un message de vérification via {providerName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="whatsapp-test-to"
                  className="text-sm font-medium"
                >
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
        )}
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}

function sendingWouldRunHint(
  enabled: boolean,
  apiKey: string,
  providerConfigured: boolean,
) {
  return (enabled && Boolean(apiKey.trim())) || providerConfigured;
}
