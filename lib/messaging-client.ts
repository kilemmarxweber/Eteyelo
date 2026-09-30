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

function readTimeoutMs(): number {
  const raw = process.env.MESSAGING_API_TIMEOUT_MS?.trim();
  if (!raw) return 8_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000) return 8_000;
  return Math.min(Math.round(n), 30_000);
}

/** Ne remonte pas de pages HTML nginx dans les toasts / logs. */
function summarizeHttpBody(status: number, text: string): string {
  const body = text.trim();
  if (/504|Gateway Time-?out/i.test(body) || status === 504) {
    return `KlamboWhatsapp timeout (${status}) — API messaging trop lente ou down.`;
  }
  if (/502|Bad Gateway/i.test(body) || status === 502) {
    return `KlamboWhatsapp bad gateway (${status}).`;
  }
  if (/503/i.test(body) || status === 503) {
    return `KlamboWhatsapp unavailable (${status}).`;
  }
  if (body.startsWith("<!") || body.startsWith("<html")) {
    return `KlamboWhatsapp HTTP ${status} (réponse HTML).`;
  }
  if (status === 401 || /Invalid API key|Unauthorized/i.test(body)) {
    return "KlamboWhatsapp 401 — MESSAGING_API_KEY invalide.";
  }
  return body.slice(0, 300) || `KlamboWhatsapp HTTP ${status}`;
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
    // Si l’appelant a déjà un signal, on le compose
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
        throw new Error(summarizeHttpBody(res.status, text));
      }
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || /aborted/i.test(error.message))
      ) {
        throw new Error(
          `KlamboWhatsapp timeout client (${this.timeoutMs}ms) — ${this.baseUrl}${path}`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onParentAbort);
    }
  }
}
