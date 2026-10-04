/**
 * Empreinte DTLS + signature Ed25519 (même vecteur que le client Flutter).
 * Run: pnpm exec tsx scripts/test-call-identity.ts
 */
import assert from "node:assert/strict";
import {
  canonicalDtlsFingerprints,
  isValidCallPublicKey,
  publicKeyFromSeed,
  signFingerprint,
  verifyFingerprint,
} from "../lib/mobile/call-identity";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("empreintes canoniques identiques au client", () => {
  const sdp = `
v=0
a=fingerprint:sha-256 AA:BB:CC
a=fingerprint:sha-256 11:22
a=fingerprint:sha-256 aa:bb:cc
`;
  assert.equal(canonicalDtlsFingerprints(sdp), "11:22|AA:BB:CC");
});

test("clé publique base64 de 32 octets", () => {
  const raw = Buffer.alloc(32, 1).toString("base64");
  assert.equal(isValidCallPublicKey(raw), true);
  assert.equal(isValidCallPublicKey("abc"), false);
  assert.equal(isValidCallPublicKey(""), false);
});

test("vecteur Ed25519 RFC 8032", () => {
  const seed = Buffer.from(
    "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
    "hex",
  );
  const pub = publicKeyFromSeed(seed);
  assert.equal(
    pub.toString("hex"),
    "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  );
  const signature = signFingerprint(seed, "");
  assert.equal(
    signature.toString("hex"),
    "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
  );
  assert.equal(
    verifyFingerprint({ publicKey: pub, fingerprint: "", signature }),
    true,
  );
  assert.equal(
    verifyFingerprint({
      publicKey: pub,
      fingerprint: "AA:BB",
      signature,
    }),
    false,
  );
});

console.log("\nAll call identity tests passed.");
