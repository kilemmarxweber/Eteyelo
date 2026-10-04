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
  candidate: string,
) {
  return existing.some((item) => {
    if (item.fromUserId !== fromUserId || !candidate) return false;
    const payload = item.payload;
    if (!payload || typeof payload !== "object") return false;
    return (payload as { candidate?: unknown }).candidate === candidate;
  });
}
