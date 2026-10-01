/**
 * Client HTTP minimal pour KlamboWhatsapp (API messaging).
 * Évite une dépendance monorepo ; même contrat que @messaging/sdk.
 */

export type MessagingSendResult = {
  success: boolean;
  logId: string;
  status: string;
  to: string;
};

export type MessagingProjectInfo = {
  id: string;
  name: string;
  slug: string;
  whatsapp_provider?: string;
};

export type MessagingDevice = {
  id: string;
  label: string;
  status: string;
  phone: string | null;
};

/** Erreur API messaging avec status/code (ex. numéro WhatsApp invalide). */
export class MessagingApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "MessagingApiError";
    this.status = status;
    this.code = code;
  }
}

function readTimeoutMs(): number {
  const raw = process.env.MESSAGING_API_TIMEOUT_MS?.trim();
  if (!raw) return 7_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000) return 7_000;
  return Math.min(Math.round(n), 30_000);
}

function parseErrorPayload(text: string): {
  code: string | null;
  message: string | null;
} {
  const body = text.trim();
  if (!body || body.startsWith("<")) {
    return { code: null, message: null };
  }
  try {
    const json = JSON.parse(body) as {
      code?: unknown;
      error?: unknown;
      message?: unknown;
    };
    const code =
      typeof json.code === "string"
        ? json.code
        : typeof json.error === "string"
          ? json.error
          : null;
    const message =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "object" &&
            json.error &&
            typeof (json.error as { message?: unknown }).message === "string"
          ? (json.error as { message: string }).message
          : null;
    return { code, message };
  } catch {
    return { code: null, message: null };
  }
}

function isWhatsAppNumberInvalid(status: number, code: string | null, body: string) {
  if (code === "WHATSAPP_NUMBER_INVALID" || code === "INVALID_JID") {
    return true;
  }
  return /WHATSAPP_NUMBER_INVALID|INVALID_JID|not registered on whatsapp|not (a )?whatsapp|n[’']a pas (de )?WhatsApp|ne possède pas de compte WhatsApp/i.test(
    body,
  ) && (status === 422 || status === 400 || status >= 400);
}

/** Messages clairs destinés à l’utilisateur final. */
export const MESSAGING_USER_MESSAGES = {
  numberNoWhatsApp:
    "Ce numéro n’a pas WhatsApp. Vérifiez le numéro et réessayez.",
  timeout: "WhatsApp met trop de temps à répondre. Réessayez dans un instant.",
  connection:
    "Impossible de contacter WhatsApp pour le moment. Réessayez plus tard.",
  sendFailed: "L’envoi WhatsApp a échoué. Réessayez plus tard.",
} as const;

/** Ne remonte pas de pages HTML nginx dans les toasts / logs. */
export function summarizeHttpBody(status: number, text: string): string {
  const body = text.trim();
  const { code, message } = parseErrorPayload(body);

  if (isWhatsAppNumberInvalid(status, code, body)) {
    return MESSAGING_USER_MESSAGES.numberNoWhatsApp;
  }
  if (
    code === "WHATSAPP_TIMEOUT" ||
    /504|Gateway Time-?out/i.test(body) ||
    status === 504
  ) {
    return MESSAGING_USER_MESSAGES.timeout;
  }
  if (
    code === "WHATSAPP_CONNECTION_ERROR" ||
    code === "WHATSAPP_PROVIDER_ERROR" ||
    /502|Bad Gateway/i.test(body) ||
    status === 502
  ) {
    return message?.trim() || MESSAGING_USER_MESSAGES.sendFailed;
  }
  if (/503/i.test(body) || status === 503) {
    return MESSAGING_USER_MESSAGES.connection;
  }
  if (body.startsWith("<!") || body.startsWith("<html")) {
    return MESSAGING_USER_MESSAGES.connection;
  }
  if (status === 401 || /Invalid API key|Unauthorized/i.test(body)) {
    return "Clé API messaging invalide. Contactez l’administrateur.";
  }
  if (message?.trim()) return message.trim().slice(0, 300);
  return body.slice(0, 300) || `Erreur d’envoi (${status}).`;
}

export class MessagingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://whatsapp-api.klambocore.com").replace(
      /\/$/,
      "",
    );
    this.timeoutMs = options.timeoutMs ?? readTimeoutMs();
  }

  async send(payload: {
    to: string;
    channel: "whatsapp" | "sms";
    type?: string;
    template?: string;
    lang?: string;
    variables?: Record<string, string>;
    text?: string;
    /** Alternance multi-files côté API Klambo (absence, payment, results…). */
    queue_kind?: string;
  }): Promise<MessagingSendResult> {
    const res = await this.request<{
      id: string;
      status: string;
      to: string;
    }>("/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "template",
        ...payload,
      }),
    });
    return {
      success: res.status !== "failed",
      logId: res.id,
      status: res.status,
      to: res.to,
    };
  }

  async getProject(): Promise<MessagingProjectInfo> {
    return this.request<MessagingProjectInfo>("/v1/project");
  }

  async listDevices(): Promise<MessagingDevice[]> {
    return this.request<MessagingDevice[]>("/v1/devices");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const parentSignal = init.signal;
    const onParentAbort = () => controller.abort();
    if (parentSignal) {
      if (parentSignal.aborted) controller.abort();
      else parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        const { code } = parseErrorPayload(text);
        const resolvedCode =
          code ??
          (isWhatsAppNumberInvalid(res.status, code, text)
            ? "WHATSAPP_NUMBER_INVALID"
            : res.status === 504
              ? "WHATSAPP_TIMEOUT"
              : res.status === 502
                ? "WHATSAPP_PROVIDER_ERROR"
                : null);
        throw new MessagingApiError(
          summarizeHttpBody(res.status, text),
          res.status,
          resolvedCode,
        );
      }
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch (error) {
      if (error instanceof MessagingApiError) throw error;
      if (
        error instanceof Error &&
        (error.name === "AbortError" || /aborted/i.test(error.message))
      ) {
        throw new MessagingApiError(
          MESSAGING_USER_MESSAGES.timeout,
          504,
          "WHATSAPP_TIMEOUT",
        );
      }
      // Ne pas masquer les autres erreurs réseau sous « WhatsApp » :
      // l’appelant (SMS / batch) doit pouvoir continuer ou basculer.
      throw error;
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onParentAbort);
    }
  }
}
