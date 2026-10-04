export const CALL_SIGNAL_TYPES = [
  "call.offer",
  "call.answer",
  "call.ice",
  "call.hangup",
  "call.reject",
  "call.ack",
  "call.busy",
  "call.renegotiate",
  "call.restart-request",
] as const;

export type CallSignalType = (typeof CALL_SIGNAL_TYPES)[number];

export function isCallSignalType(type: string): type is CallSignalType {
  return (CALL_SIGNAL_TYPES as readonly string[]).includes(type);
}

export function shouldMarkBusy(params: {
  type: string;
  senderId: string;
  calleeId: string;
  status: string;
}) {
  return (
    params.type === "call.busy" &&
    params.senderId === params.calleeId &&
    params.status === "RINGING"
  );
}

export function isDuplicateIce(
  existing: Array<{ fromUserId: string; payload: unknown }>,
  fromUserId: string,
  payload: unknown,
) {
  const candidate =
    payload && typeof payload === "object"
      ? String((payload as { candidate?: unknown }).candidate ?? "")
      : "";
  const payloadKey = JSON.stringify(payload ?? null);

  return existing.some((item) => {
    if (item.fromUserId !== fromUserId) return false;
    if (candidate) {
      const itemPayload = item.payload;
      if (!itemPayload || typeof itemPayload !== "object") return false;
      return (
        String((itemPayload as { candidate?: unknown }).candidate ?? "") ===
        candidate
      );
    }
    // Sans champ candidate : dédupliquer sur le payload entier (évite accumuler des copies).
    return JSON.stringify(item.payload ?? null) === payloadKey;
  });
}
