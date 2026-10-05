import { prisma } from "@/lib/prisma";

const memory = new Map<string, { token: string; platform: string }>();
let tableReady = false;

export function shouldSendCallPush(serverKey: string | undefined | null) {
  return Boolean(serverKey && serverKey.trim());
}

export function buildFcmCallMessage(params: {
  token: string;
  callId: string;
  callerName: string;
  kind: string;
}) {
  return {
    to: params.token,
    priority: "high" as const,
    content_available: true,
    data: {
      type: "call.offer",
      callId: params.callId,
      callerName: params.callerName,
      kind: params.kind,
    },
  };
}

async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS call_push_token (
      user_id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      platform TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

export async function saveCallPushToken(params: {
  userId: string;
  token: string;
  platform: string;
}) {
  memory.set(params.userId, {
    token: params.token,
    platform: params.platform,
  });
  try {
    await ensureTable();
    await prisma.$executeRaw`
      INSERT INTO call_push_token (user_id, token, platform, updated_at)
      VALUES (${params.userId}, ${params.token}, ${params.platform}, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET token = ${params.token},
          platform = ${params.platform},
          updated_at = NOW()
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[call-push] postgres write failed: ${message}`);
  }
}

export async function readCallPushToken(userId: string) {
  try {
    await ensureTable();
    const rows = await prisma.$queryRaw<
      Array<{ token: string; platform: string }>
    >`
      SELECT token, platform FROM call_push_token WHERE user_id = ${userId} LIMIT 1
    `;
    if (rows[0]) {
      memory.set(userId, rows[0]);
      return rows[0];
    }
  } catch {
    // repli mémoire
  }
  return memory.get(userId) ?? null;
}

export async function dispatchCallPush(params: {
  userId: string;
  callId: string;
  callerName: string;
  kind: string;
  fetchImpl?: typeof fetch;
}) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!shouldSendCallPush(serverKey)) {
    return { sent: 0, skipped: "no-fcm-key" as const };
  }
  const row = await readCallPushToken(params.userId);
  if (!row?.token) return { sent: 0, skipped: "no-token" as const };
  const body = buildFcmCallMessage({
    token: row.token,
    callId: params.callId,
    callerName: params.callerName,
    kind: params.kind,
  });
  const send = params.fetchImpl ?? fetch;
  const response = await send("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { sent: response.ok ? 1 : 0, skipped: null };
}

export async function buildFcmMessagePush(params: {
  token: string;
  conversationId: string;
  title: string;
  body: string;
}) {
  return {
    to: params.token,
    priority: "high" as const,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: {
      type: "message.created",
      conversationId: params.conversationId,
    },
  };
}

export async function dispatchMessagePush(params: {
  userIds: string[];
  conversationId: string;
  title: string;
  body: string;
  fetchImpl?: typeof fetch;
}) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!shouldSendCallPush(serverKey)) {
    return { sent: 0, skipped: "no-fcm-key" as const };
  }
  let sent = 0;
  const send = params.fetchImpl ?? fetch;
  for (const userId of params.userIds) {
    const row = await readCallPushToken(userId);
    if (!row?.token) continue;
    const payload = await buildFcmMessagePush({
      token: row.token,
      conversationId: params.conversationId,
      title: params.title,
      body: params.body,
    });
    try {
      const response = await send("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[call-push] message fcm failed: ${message}`);
    }
  }
  return { sent, skipped: null };
}
