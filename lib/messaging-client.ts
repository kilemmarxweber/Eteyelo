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

export class MessagingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "http://localhost:3001").replace(
      /\/$/,
      "",
    );
  }

  async send(payload: {
    to: string;
    channel: "whatsapp" | "sms";
    type?: string;
    template?: string;
    lang?: string;
    variables?: Record<string, string>;
    text?: string;
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
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `KlamboWhatsapp HTTP ${res.status}`);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
  }
}
