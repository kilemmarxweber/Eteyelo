"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconBrandGoogleDrive,
  IconCheck,
  IconCloud,
  IconCopy,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import {
  createLibraryCatalogSourceAction,
  deleteLibraryCatalogSourceAction,
  listLibraryCatalogSourcesAction,
  syncLibraryCatalogSourceAction,
  toggleLibraryCatalogSourceAction,
} from "../bibliotheque-sources.action";

type DriveAuthMode = "service_account" | "api_key" | "none";

type CatalogSource = {
  id: string;
  name: string;
  url: string;
  isEnabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  fileCount: number;
  hasApiKey: boolean;
};

function formatSyncDate(value: string | null): string {
  if (!value) return "Jamais synchronisé";
  try {
    return new Date(value).toLocaleString("fr-FR");
  } catch {
    return value;
  }
}

export default function LibrarySourcesSettingsPage() {
  const [sources, setSources] = useState<CatalogSource[]>([]);
  const [envApiKeyConfigured, setEnvApiKeyConfigured] = useState(false);
  const [serviceAccountConfigured, setServiceAccountConfigured] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(
    null,
  );
  const [driveAuthMode, setDriveAuthMode] = useState<DriveAuthMode>("none");
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const reload = () =>
    startTransition(async () => {
      const [data, err] = await listLibraryCatalogSourcesAction();
      if (err) {
        toast.error(err.message);
        return;
      }
      if (!data) return;
      setSources(data.sources);
      setEnvApiKeyConfigured(data.envApiKeyConfigured);
      setServiceAccountConfigured(data.serviceAccountConfigured);
      setServiceAccountEmail(data.serviceAccountEmail);
      setDriveAuthMode(data.driveAuthMode);
      setLoaded(true);
    });

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyServiceAccountEmail() {
    if (!serviceAccountEmail) return;
    try {
      await navigator.clipboard.writeText(serviceAccountEmail);
      setCopied(true);
      toast.success("E-mail du compte de service copié.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier. Sélectionnez l’e-mail manuellement.");
    }
  }

  function addSource() {
    startTransition(async () => {
      const [created, err] = await createLibraryCatalogSourceAction({
        name,
        url,
        apiKey: apiKey.trim() || null,
        isEnabled: true,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (created) {
        setSources((current) => [...current, created]);
        setName("");
        setUrl("");
        setApiKey("");
        toast.success("Source ajoutée. Synchronisez pour importer les livres.");
      }
    });
  }

  function toggleSource(source: CatalogSource, isEnabled: boolean) {
    startTransition(async () => {
      const [updated, err] = await toggleLibraryCatalogSourceAction({
        id: source.id,
        isEnabled,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (updated) {
        setSources((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    });
  }

  function removeSource(source: CatalogSource) {
    if (
      !window.confirm(
        `Retirer « ${source.name} » et ses livres importés de la bibliothèque ?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const [, err] = await deleteLibraryCatalogSourceAction({ id: source.id });
      if (err) {
        toast.error(err.message);
        return;
      }
      setSources((current) => current.filter((item) => item.id !== source.id));
      toast.success("Source retirée.");
    });
  }

  function syncSource(source: CatalogSource) {
    setSyncingId(source.id);
    startTransition(async () => {
      const [updated, err] = await syncLibraryCatalogSourceAction({
        id: source.id,
      });
      setSyncingId(null);
      if (err) {
        toast.error(err.message);
        reload();
        return;
      }
      if (updated) {
        setSources((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        toast.success(
          `${updated.imported} livre${updated.imported > 1 ? "s" : ""} importé${updated.imported > 1 ? "s" : ""} depuis Drive.`,
        );
      }
    });
  }

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Sources de la bibliothèque</h2>
            <Badge variant="outline-primary" icon={<IconCloud size={14} />}>
              Lecture seule
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Le serveur lit Drive avec un compte de service (rôle Lecteur). Les
            élèves n’ont jamais le lien Drive : ils lisent via Eteyelo.
          </p>
        </div>

        {driveAuthMode === "service_account" && serviceAccountEmail ? (
          <Alert>
            <AlertTitle>E-mail à coller dans Google Drive</AlertTitle>
            <AlertDescription className="space-y-3">
              <ol className="list-decimal space-y-1 pl-4 text-sm">
                <li>Ouvrez le dossier des livres dans Google Drive.</li>
                <li>
                  Cliquez sur <strong>Partager</strong>.
                </li>
                <li>
                  Collez l’e-mail ci-dessous, rôle <strong>Lecteur</strong>{" "}
                  (pas Éditeur).
                </li>
                <li>
                  Accès général : <strong>Restreint</strong> — ne passez pas en
                  « Toute personne disposant du lien ».
                </li>
                <li>
                  Revenez ici, collez le lien du dossier, puis synchronisez.
                </li>
              </ol>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={serviceAccountEmail}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyServiceAccountEmail}
                >
                  {copied ? (
                    <IconCheck className="mr-1.5 size-4" />
                  ) : (
                    <IconCopy className="mr-1.5 size-4" />
                  )}
                  {copied ? "Copié" : "Copier l’e-mail"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Compte de service non configuré</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                Ne collez jamais la clé privée dans cette page. Ajoutez-la
                uniquement dans <code>.env</code> du serveur :
              </p>
              <ul className="list-disc pl-4">
                <li>
                  <code>GOOGLE_CLIENT_EMAIL</code> —{" "}
                  <code>…@….iam.gserviceaccount.com</code>
                </li>
                <li>
                  <code>GOOGLE_PRIVATE_KEY</code> — bloc{" "}
                  <code>-----BEGIN PRIVATE KEY-----</code>
                </li>
              </ul>
              <p>
                Google Cloud : activez l’API Drive, créez un compte de service,
                téléchargez le JSON. Puis rechargez cette page : l’e-mail à
                partager s’affichera.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconPlus className="size-5" />
              Nouvelle source Google Drive
            </CardTitle>
            <CardDescription>
              Ici, seulement le nom et le lien du dossier. La lecture est
              autorisée par le partage « Lecteur » vers le compte de service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="library-source-name">Nom (optionnel)</Label>
                <Input
                  id="library-source-name"
                  placeholder="Livres du collège"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="library-source-url">
                  Lien du dossier <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="library-source-url"
                  placeholder="https://drive.google.com/drive/folders/…"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Collez l’URL du dossier (…/folders/…) ou son identifiant. Les
                  PDF et EPUB du dossier et des sous-dossiers seront listés.
                </p>
              </div>
              {!serviceAccountConfigured ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="library-source-key">
                    Clé API Google Drive (repli, déconseillé)
                  </Label>
                  <Input
                    id="library-source-key"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      envApiKeyConfigured
                        ? "Clé plateforme déjà configurée — laissez vide"
                        : "AIza… — uniquement si le dossier est public"
                    }
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Repli uniquement : dossier « Toute personne disposant du
                    lien ». Préférez le compte de service (lecture restreinte).
                  </p>
                </div>
              ) : null}
            </div>
            <Button onClick={addSource} disabled={pending || !url.trim()}>
              <IconBrandGoogleDrive className="mr-2 size-4" />
              Ajouter cette source
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sources configurées</CardTitle>
            <CardDescription>
              Activez celles à utiliser. Vous pouvez en garder plusieurs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loaded ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune source externe pour le moment. Les livres uploadés dans
                l’école restent disponibles.
              </p>
            ) : (
              sources.map((source) => (
                <div
                  key={source.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{source.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {source.url}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {source.fileCount} livre
                        {source.fileCount > 1 ? "s" : ""} ·{" "}
                        {formatSyncDate(source.lastSyncedAt)}
                        {source.hasApiKey ? " · clé API enregistrée" : ""}
                      </p>
                      {source.lastError ? (
                        <p className="mt-2 text-xs text-destructive">
                          {source.lastError}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {source.isEnabled ? "Activée" : "Désactivée"}
                      </span>
                      <Switch
                        checked={source.isEnabled}
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          toggleSource(source, checked)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => syncSource(source)}
                    >
                      <IconRefresh
                        className={`mr-1.5 size-4 ${syncingId === source.id ? "animate-spin" : ""}`}
                      />
                      Synchroniser
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => removeSource(source)}
                    >
                      <IconTrash className="mr-1.5 size-4" />
                      Retirer
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
