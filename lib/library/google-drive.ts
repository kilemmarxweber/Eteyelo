import crypto from "crypto";
import { Readable } from "stream";

export const GDRIVE_FILE_PREFIX = "gdrive://";
export const GOOGLE_DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const PDF_MIME = "application/pdf";
const EPUB_MIMES = new Set([
  "application/epub+zip",
  "application/x-epub+zip",
]);
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type DriveListedFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  fileType: "PDF" | "EPUB";
};

export type GoogleDriveAuthMode = "service_account" | "api_key" | "none";

export type GoogleDriveAuthStatus = {
  mode: GoogleDriveAuthMode;
  serviceAccountEmail: string | null;
  envApiKeyConfigured: boolean;
};

export type GoogleServiceAccountCredentials = {
  clientEmail: string;
  privateKey: string;
};

type DriveRequestAuth =
  | { kind: "service_account"; accessToken: string; email: string }
  | { kind: "api_key"; apiKey: string };

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

export function isGoogleDriveStorageKey(storageKey: string): boolean {
  return storageKey.startsWith(GDRIVE_FILE_PREFIX);
}

export function driveFileIdFromStorageKey(storageKey: string): string | null {
  if (!storageKey.startsWith(GDRIVE_FILE_PREFIX)) return null;
  const id = storageKey.slice(GDRIVE_FILE_PREFIX.length).trim();
  return id || null;
}

export function toDriveStorageKey(fileId: string): string {
  return `${GDRIVE_FILE_PREFIX}${fileId}`;
}

/** Extrait l’id d’un dossier Drive depuis un lien de partage ou un id brut. */
export function parseGoogleDriveFolderId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const fromPath = raw.match(
    /(?:drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|folders\/)|id=)([a-zA-Z0-9_-]{20,})/,
  );
  if (fromPath?.[1]) return fromPath[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw) && !raw.includes("/")) {
    return raw;
  }

  return null;
}

export function normalizeGooglePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").trim();
}

export function parseGoogleServiceAccountJson(
  raw: string,
): GoogleServiceAccountCredentials | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      client_email?: unknown;
      private_key?: unknown;
    };
    const clientEmail =
      typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
    const privateKey =
      typeof parsed.private_key === "string"
        ? normalizeGooglePrivateKey(parsed.private_key)
        : "";
    if (!clientEmail || !privateKey.includes("BEGIN")) return null;
    return { clientEmail, privateKey };
  } catch {
    return null;
  }
}

export function resolveGoogleDriveApiKey(sourceApiKey?: string | null): string {
  return (
    sourceApiKey?.trim() ||
    process.env.GOOGLE_DRIVE_API_KEY?.trim() ||
    ""
  );
}

export function getGoogleServiceAccountCredentials(): GoogleServiceAccountCredentials | null {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonEnv) {
    const fromJson = parseGoogleServiceAccountJson(jsonEnv);
    if (fromJson) return fromJson;
  }

  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY?.trim() || "";
  if (privateKeyRaw.startsWith("{")) {
    const fromEmbeddedJson = parseGoogleServiceAccountJson(privateKeyRaw);
    if (fromEmbeddedJson) return fromEmbeddedJson;
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim() || "";
  const privateKey = privateKeyRaw
    ? normalizeGooglePrivateKey(privateKeyRaw)
    : "";
  if (!clientEmail || !privateKey.includes("BEGIN")) return null;
  return { clientEmail, privateKey };
}

export function getGoogleDriveAuthStatus(): GoogleDriveAuthStatus {
  const credentials = getGoogleServiceAccountCredentials();
  const envApiKeyConfigured = Boolean(
    process.env.GOOGLE_DRIVE_API_KEY?.trim(),
  );
  if (credentials) {
    return {
      mode: "service_account",
      serviceAccountEmail: credentials.clientEmail,
      envApiKeyConfigured,
    };
  }
  if (envApiKeyConfigured) {
    return {
      mode: "api_key",
      serviceAccountEmail: null,
      envApiKeyConfigured,
    };
  }
  return {
    mode: "none",
    serviceAccountEmail: null,
    envApiKeyConfigured: false,
  };
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
}

function signServiceAccountJwt(
  credentials: GoogleServiceAccountCredentials,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: GOOGLE_DRIVE_READONLY_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credentials.privateKey);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

async function fetchServiceAccountAccessToken(
  credentials: GoogleServiceAccountCredentials,
): Promise<{ token: string; expiresInSec: number }> {
  const assertion = signServiceAccountJwt(credentials);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !json?.access_token) {
    throw new Error(
      json?.error_description ||
        json?.error ||
        "Impossible d’obtenir un jeton Google Drive (compte de service).",
    );
  }
  return {
    token: json.access_token,
    expiresInSec: Number(json.expires_in) || 3600,
  };
}

async function getServiceAccountAccessToken(): Promise<{
  token: string;
  email: string;
}> {
  const credentials = getGoogleServiceAccountCredentials();
  if (!credentials) {
    throw new Error(
      "Compte de service Google manquant. Définissez GOOGLE_CLIENT_EMAIL et GOOGLE_PRIVATE_KEY.",
    );
  }
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > now + 60_000) {
    return { token: cachedAccessToken.token, email: credentials.clientEmail };
  }
  const { token, expiresInSec } =
    await fetchServiceAccountAccessToken(credentials);
  cachedAccessToken = {
    token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return { token, email: credentials.clientEmail };
}

async function resolveDriveRequestAuth(
  sourceApiKey?: string | null,
): Promise<DriveRequestAuth> {
  const credentials = getGoogleServiceAccountCredentials();
  if (credentials) {
    const { token, email } = await getServiceAccountAccessToken();
    return { kind: "service_account", accessToken: token, email };
  }
  const apiKey = resolveGoogleDriveApiKey(sourceApiKey);
  if (apiKey) {
    return { kind: "api_key", apiKey };
  }
  throw new Error(
    "Google Drive n’est pas configuré. Ajoutez GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (recommandé, lecture seule), ou une clé API.",
  );
}

function driveApiUrl(
  path: string,
  params: Record<string, string>,
  apiKey?: string,
): string {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (apiKey) url.searchParams.set("key", apiKey);
  return url.toString();
}

function shareHint(auth: DriveRequestAuth): string {
  if (auth.kind === "service_account") {
    return `Dans Drive, Partager → coller ${auth.email} → rôle « Lecteur ». Laissez l’accès général sur « Restreint » (pas « Toute personne disposant du lien »).`;
  }
  return "Partagez le dossier en « Toute personne disposant du lien » (lecteur) et ajoutez une clé API Drive, ou configurez un compte de service.";
}

async function driveJson<T>(url: string, auth: DriveRequestAuth): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth.kind === "service_account") {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  const response = await fetch(url, { cache: "no-store", headers });
  const body = await response.text();
  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      throw new Error(`Google Drive refuse l’accès. ${shareHint(auth)}`);
    }
    if (response.status === 404) {
      throw new Error(
        `Dossier Google Drive introuvable. ${shareHint(auth)}`,
      );
    }
    throw new Error(
      `Impossible de lire le dossier Google Drive (${response.status}).`,
    );
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Réponse Google Drive invalide.");
  }
}

function resolveBookFileType(
  name: string,
  mimeType: string,
): "PDF" | "EPUB" | null {
  if (mimeType === PDF_MIME || name.toLowerCase().endsWith(".pdf")) return "PDF";
  if (EPUB_MIMES.has(mimeType) || name.toLowerCase().endsWith(".epub")) {
    return "EPUB";
  }
  return null;
}

type DriveApiFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
};

async function listChildren(
  folderId: string,
  auth: DriveRequestAuth,
): Promise<DriveApiFile[]> {
  const files: DriveApiFile[] = [];
  let pageToken = "";

  do {
    const params: Record<string, string> = {
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,size)",
      pageSize: "100",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    };
    if (pageToken) params.pageToken = pageToken;
    const apiKey = auth.kind === "api_key" ? auth.apiKey : undefined;
    const data = await driveJson<{
      files?: DriveApiFile[];
      nextPageToken?: string;
    }>(driveApiUrl("files", params, apiKey), auth);
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return files;
}

/** Liste PDF / EPUB (sous-dossiers inclus, profondeur limitée). */
export async function listGoogleDriveLibraryFiles(options: {
  folderId: string;
  apiKey?: string | null;
  maxDepth?: number;
  maxFiles?: number;
}): Promise<DriveListedFile[]> {
  const auth = await resolveDriveRequestAuth(options.apiKey);

  const maxDepth = options.maxDepth ?? 4;
  const maxFiles = options.maxFiles ?? 400;
  const collected: DriveListedFile[] = [];
  const visited = new Set<string>();

  const walk = async (folderId: string, depth: number) => {
    if (depth < 0 || collected.length >= maxFiles) return;
    if (visited.has(folderId)) return;
    visited.add(folderId);

    const children = await listChildren(folderId, auth);
    for (const child of children) {
      if (collected.length >= maxFiles) return;
      if (!child.id || !child.name) continue;
      if (child.mimeType === FOLDER_MIME) {
        await walk(child.id, depth - 1);
        continue;
      }
      const fileType = resolveBookFileType(child.name, child.mimeType ?? "");
      if (!fileType) continue;
      collected.push({
        id: child.id,
        name: child.name,
        mimeType: child.mimeType ?? "",
        size: child.size ? Number(child.size) : undefined,
        fileType,
      });
    }
  };

  await walk(options.folderId, maxDepth);
  return collected;
}

export function titleFromDriveFileName(fileName: string): string {
  return fileName.replace(/\.(pdf|epub)$/i, "").trim() || fileName;
}

export async function openGoogleDriveFileStream(options: {
  fileId: string;
  apiKey?: string | null;
  fileType: "PDF" | "EPUB";
}): Promise<{ stream: Readable; mimeType: string; size?: number }> {
  const mimeType =
    options.fileType === "EPUB" ? "application/epub+zip" : "application/pdf";

  const credentials = getGoogleServiceAccountCredentials();
  if (credentials) {
    const { token, email } = await getServiceAccountAccessToken();
    const url = driveApiUrl(`files/${encodeURIComponent(options.fileId)}`, {
      alt: "media",
      supportsAllDrives: "true",
    });
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok || !response.body) {
      throw new Error(
        `Téléchargement Drive refusé (${response.status}). Partagez le dossier avec ${email} en « Lecteur ».`,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      throw new Error(
        `Google Drive a renvoyé une page d’attente. Partagez le fichier avec ${email} en « Lecteur ».`,
      );
    }
    const sizeHeader = response.headers.get("content-length");
    return {
      stream: Readable.fromWeb(response.body as never),
      mimeType: contentType || mimeType,
      size: sizeHeader ? Number(sizeHeader) : undefined,
    };
  }

  const apiKey = resolveGoogleDriveApiKey(options.apiKey);
  const urls: string[] = [];
  if (apiKey) {
    urls.push(
      driveApiUrl(
        `files/${encodeURIComponent(options.fileId)}`,
        { alt: "media", supportsAllDrives: "true" },
        apiKey,
      ),
    );
  }
  urls.push(
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(options.fileId)}&confirm=t`,
  );

  let lastError = "Fichier Drive introuvable.";
  for (const url of urls) {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok || !response.body) {
      lastError = `Téléchargement Drive refusé (${response.status}).`;
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      lastError =
        "Google Drive a renvoyé une page d’attente. Vérifiez le partage du fichier.";
      continue;
    }
    const sizeHeader = response.headers.get("content-length");
    return {
      stream: Readable.fromWeb(response.body as never),
      mimeType: contentType || mimeType,
      size: sizeHeader ? Number(sizeHeader) : undefined,
    };
  }

  throw new Error(lastError);
}
