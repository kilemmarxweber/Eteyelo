import fs from "fs";

const t = fs.readFileSync(".env", "utf8");
function get(name) {
  const m = t.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const k = get("MESSAGING_API_KEY");
const meta = get("MESSAGING_META_API_KEY");
const base = get("MESSAGING_API_BASE_URL").replace(/\/$/, "");
function hint(key) {
  if (!key) return "(empty)";
  return `${key.slice(0, 12)}…${key.slice(-4)} len=${key.length}`;
}
async function probe(label, key) {
  if (!key) {
    console.log(label, "skip empty");
    return;
  }
  const res = await fetch(`${base}/v1/project`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  console.log(label, hint(key), "=>", res.status, body.slice(0, 140));
}
console.log("base", base);
await probe("MESSAGING_API_KEY", k);
await probe("MESSAGING_META_API_KEY", meta);
if (k.startsWith("sk_live_")) {
  await probe("as_sk_test", "sk_test_" + k.slice("sk_live_".length));
}
if (meta.startsWith("sk_test_")) {
  await probe("meta_as_sk_live", "sk_live_" + meta.slice("sk_test_".length));
}
