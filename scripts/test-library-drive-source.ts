import assert from "node:assert/strict";

import {
  normalizeGooglePrivateKey,
  parseGoogleDriveFolderId,
  parseGoogleServiceAccountJson,
} from "../lib/library/google-drive";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("extrait l’id d’un lien de dossier Drive", () => {
  assert.equal(
    parseGoogleDriveFolderId(
      "https://drive.google.com/drive/folders/14plAylMk7TTlgShoL7nYkRgHKqnB5aM9?usp=sharing",
    ),
    "14plAylMk7TTlgShoL7nYkRgHKqnB5aM9",
  );
  assert.equal(
    parseGoogleDriveFolderId(
      "https://drive.google.com/drive/u/0/folders/14plAylMk7TTlgShoL7nYkRgHKqnB5aM9",
    ),
    "14plAylMk7TTlgShoL7nYkRgHKqnB5aM9",
  );
  assert.equal(
    parseGoogleDriveFolderId("14plAylMk7TTlgShoL7nYkRgHKqnB5aM9"),
    "14plAylMk7TTlgShoL7nYkRgHKqnB5aM9",
  );
  assert.equal(parseGoogleDriveFolderId("https://example.com/x"), null);
});

test("normalise les sauts de ligne d’une clé privée .env", () => {
  assert.equal(
    normalizeGooglePrivateKey(
      '"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n"',
    ),
    "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----",
  );
});

test("lit client_email et private_key depuis le JSON du compte de service", () => {
  const parsed = parseGoogleServiceAccountJson(
    JSON.stringify({
      type: "service_account",
      client_email: "eteyelo-library@demo.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n",
    }),
  );
  assert.ok(parsed);
  assert.equal(
    parsed?.clientEmail,
    "eteyelo-library@demo.iam.gserviceaccount.com",
  );
  assert.equal(
    parsed?.privateKey,
    "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----",
  );
  assert.equal(parseGoogleServiceAccountJson("AIza-not-json"), null);
});

console.log("Library Drive source tests passed.");
