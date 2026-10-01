import assert from "node:assert/strict";
import {
  isStructuredMessageBody,
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

console.log("sanitizeMessageBody ok");
