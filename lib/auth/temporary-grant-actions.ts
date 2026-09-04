/** Actions d'écriture : un octroi create / update / delete inclut aussi la lecture. */
export const WRITE_ACTIONS_THAT_INCLUDE_READ = [
  "create",
  "update",
  "delete",
] as const;

export type WriteActionThatIncludesRead =
  (typeof WRITE_ACTIONS_THAT_INCLUDE_READ)[number];

export function writeActionIncludesRead(action: string): boolean {
  return WRITE_ACTIONS_THAT_INCLUDE_READ.includes(
    action.toLowerCase() as WriteActionThatIncludesRead,
  );
}

/**
 * Actions effectives d'un octroi : create / update / delete s'accompagnent
 * toujours de `read`. `read` et `encaisser` restent des octrois autonomes.
 */
export function expandTemporaryGrantActions(action: string): string[] {
  const normalized = action.trim().toLowerCase() || "read";
  if (writeActionIncludesRead(normalized)) {
    return [normalized, "read"];
  }
  return [normalized];
}
