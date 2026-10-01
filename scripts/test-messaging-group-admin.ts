/**
 * Groupes messagerie — admin effectif / repliesLocked.
 * Run: pnpm exec tsx scripts/test-messaging-group-admin.ts
 */
import assert from "node:assert/strict";
import { isEffectiveGroupAdmin } from "../lib/messaging/messaging-service";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

const creatorId = "creator-1";
const adminId = "admin-2";
const memberId = "member-3";

test("créateur MEMBER + ADMIN explicite : créateur n'est plus admin", () => {
  const peers = [
    { userId: creatorId, role: "MEMBER" },
    { userId: adminId, role: "ADMIN" },
    { userId: memberId, role: "MEMBER" },
  ];
  assert.equal(
    isEffectiveGroupAdmin({
      actorUserId: creatorId,
      actorRole: "MEMBER",
      createdById: creatorId,
      type: "GROUP",
      participants: peers,
    }),
    false,
  );
  assert.equal(
    isEffectiveGroupAdmin({
      actorUserId: adminId,
      actorRole: "ADMIN",
      createdById: creatorId,
      type: "GROUP",
      participants: peers,
    }),
    true,
  );
});

test("rétrocompat : sans ADMIN explicite, le créateur reste admin", () => {
  const peers = [
    { userId: creatorId, role: "MEMBER" },
    { userId: memberId, role: "MEMBER" },
  ];
  assert.equal(
    isEffectiveGroupAdmin({
      actorUserId: creatorId,
      actorRole: "MEMBER",
      createdById: creatorId,
      type: "GROUP",
      participants: peers,
    }),
    true,
  );
  assert.equal(
    isEffectiveGroupAdmin({
      actorUserId: memberId,
      actorRole: "MEMBER",
      createdById: creatorId,
      type: "GROUP",
      participants: peers,
    }),
    false,
  );
});

test("rôle ADMIN explicite gagne toujours", () => {
  const peers = [
    { userId: creatorId, role: "ADMIN" },
    { userId: memberId, role: "MEMBER" },
  ];
  assert.equal(
    isEffectiveGroupAdmin({
      actorUserId: creatorId,
      actorRole: "ADMIN",
      createdById: creatorId,
      type: "GROUP",
      participants: peers,
    }),
    true,
  );
});

test("DIRECT n'est jamais admin de groupe", () => {
  assert.equal(
    isEffectiveGroupAdmin({
      actorUserId: creatorId,
      actorRole: "ADMIN",
      createdById: creatorId,
      type: "DIRECT",
      participants: [{ userId: creatorId, role: "ADMIN" }],
    }),
    false,
  );
});

console.log("\nAll messaging group-admin tests passed.");
