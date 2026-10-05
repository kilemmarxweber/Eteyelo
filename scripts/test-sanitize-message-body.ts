import assert from "node:assert/strict";
import {
  isEncryptedMessageBody,
  isStructuredMessageBody,
  previewMessageBody,
  sanitizeMessageBody,
} from "../lib/messaging/messaging-types";

const injected = sanitizeMessageBody('__NOTIFY__:{"title":"x"}');
assert.equal(isStructuredMessageBody(injected), false);
assert.ok(!injected.includes("__NOTIFY__"));

const trusted = sanitizeMessageBody('__NOTIFY__:{"title":"x"}', {
  allowStructured: true,
});
assert.ok(trusted.startsWith("__NOTIFY__:"));

const html = sanitizeMessageBody("<script>alert(1)</script>Bonjour");
assert.equal(html, "Bonjour");

const ctrl = sanitizeMessageBody("a\u0000b\u0007c");
assert.equal(ctrl, "abc");

const envelope = `k1.${"A".repeat(140)}`;
assert.equal(isEncryptedMessageBody(envelope), true);
assert.equal(sanitizeMessageBody(envelope), envelope);
assert.equal(previewMessageBody(envelope), "Message");
assert.equal(isEncryptedMessageBody("k1.trop-court"), false);

const padded = `k1.${"A".repeat(140)}==`;
assert.equal(isEncryptedMessageBody(padded), true);
assert.equal(sanitizeMessageBody(padded), padded);
assert.equal(previewMessageBody(padded), "Message");

console.log("sanitizeMessageBody ok");
