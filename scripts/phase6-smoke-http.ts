/**
 * Phase 6 HTTP smoke: public priority pages + demo sign-in attempts.
 * Usage: npx tsx scripts/phase6-smoke-http.ts [baseUrl]
 */
import { DEMO_ACCOUNTS } from "../prisma/seeds/demoAccounts";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const publicPages = [
  "/inscription",
  "/depot-candidature",
  "/resultats",
  "/etablissements",
];

type Result = {
  name: string;
  ok: boolean;
  detail: string;
};

const results: Result[] = [];

async function checkPublic(path: string) {
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = res.status >= 200 && res.status < 400;
    results.push({
      name: `GET ${path}`,
      ok,
      detail: `status=${res.status}`,
    });
  } catch (e) {
    results.push({
      name: `GET ${path}`,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

async function trySignIn(email: string, password: string, label: string) {
  const url = `${baseUrl}/api/auth/sign-in/email`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
      },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const cookieHeader =
      setCookie.length > 0
        ? setCookie.map((c) => c.split(";")[0]).join("; ")
        : (res.headers.get("set-cookie") ?? "");
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "";
    }
    let redirectPath: string | null = null;
    if (res.ok && cookieHeader) {
      const redirectRes = await fetch(`${baseUrl}/api/auth/post-login-redirect`, {
        headers: { cookie: cookieHeader },
      });
      const redirectJson = (await redirectRes.json().catch(() => ({}))) as {
        path?: string;
      };
      redirectPath = redirectJson.path ?? null;
      results.push({
        name: `sign-in ${label} (${email})`,
        ok: redirectRes.ok && !!redirectPath,
        detail: `signIn=${res.status}; redirect=${redirectPath ?? "none"}; body=${bodyText.slice(0, 120)}`,
      });
    } else {
      results.push({
        name: `sign-in ${label} (${email})`,
        ok: false,
        detail: `signIn=${res.status}; cookies=${cookieHeader ? "yes" : "no"}; body=${bodyText.slice(0, 160)}`,
      });
    }
  } catch (e) {
    results.push({
      name: `sign-in ${label} (${email})`,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

async function main() {
  console.log("BASE_URL:", baseUrl);

  for (const path of publicPages) {
    await checkPublic(path);
  }

  // Probe etablissements detail if list returns a branch link — best-effort skip.
  try {
    const listRes = await fetch(`${baseUrl}/etablissements`);
    const html = await listRes.text();
    const match = html.match(/\/etablissements\/([a-zA-Z0-9_-]+)/);
    if (match) {
      await checkPublic(`/etablissements/${match[1]}`);
    } else {
      results.push({
        name: "GET /etablissements/[branchId]",
        ok: true,
        detail: "skipped — no branch link found in HTML (empty seed?)",
      });
    }
  } catch (e) {
    results.push({
      name: "GET /etablissements/[branchId]",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  console.log("\n=== DEMO SIGN-IN ATTEMPTS ===");
  for (const account of DEMO_ACCOUNTS) {
    await trySignIn(account.email, account.password, account.label);
  }

  console.log("\n=== RESULTS ===");
  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    if (!r.ok) failed += 1;
    console.log(`[${mark}] ${r.name} — ${r.detail}`);
  }
  console.log(`\nSUMMARY: ${results.length - failed}/${results.length} ok`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
