/**
 * Unit 11 — QA HTTP matrice URL directe (login réel + navigation).
 * Usage: npx tsx scripts/qa-unit-11-http-matrix.ts [baseUrl]
 */
import "dotenv/config";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ORG_ID = "org_eteyelo_demo";
const BRANCH_ID = "cmruzkbw4000068tmt6xjehei";
const branchBase = `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`;

type Account = {
  role: string;
  email: string;
  password: string;
  urlOk: string;
  urlKo: string;
};

const ACCOUNTS: Account[] = [
  {
    role: "caissier",
    email: "caissier@eteyelo.cd",
    password: "Password123!",
    urlOk: `${branchBase}/paiement`,
    urlKo: `${branchBase}/notes`,
  },
  {
    role: "élève",
    email: "kasongo.junior@eleve.cd",
    password: "Student123!",
    urlOk: `${branchBase}/results`,
    urlKo: `${branchBase}/frais`,
  },
  {
    role: "parent",
    email: "kasongo@parent.cd",
    password: "Password123!",
    urlOk: `${branchBase}/notes`,
    urlKo: `${branchBase}/frais`,
  },
  {
    role: "enseignant",
    email: "prof.mukendi@eteyelo.cd",
    password: "Password123!",
    urlOk: `${branchBase}/notes`,
    urlKo: `${branchBase}/paiement`,
  },
  {
    role: "directeur_etudes",
    email: "directeur.etudes@eteyelo.cd",
    password: "Password123!",
    urlOk: `${branchBase}/classe`,
    urlKo: `${branchBase}/paiement`,
  },
  {
    role: "directeur",
    email: "directeur@eteyelo.cd",
    password: "Password123!",
    urlOk: `${branchBase}/paiement`,
    urlKo: `${branchBase}/settings/support`,
  },
  {
    role: "préfet",
    email: "prefet@eteyelo.cd",
    password: "Password123!",
    urlOk: `${branchBase}/paiement`,
    urlKo: `${branchBase}/settings/support`,
  },
  {
    role: "gestionnaire",
    email: "admin@eteyelo.cd",
    password: "Admin123!",
    urlOk: `${branchBase}/paiement`,
    urlKo: `${branchBase}/settings/support`,
  },
];

type Row = {
  role: string;
  email: string;
  signInOk: boolean;
  redirect: string | null;
  urlOk: { path: string; finalPath: string; status: number; allowed: boolean };
  urlKo: { path: string; finalPath: string; status: number; denied: boolean };
  detail: string;
};

function cookieHeaderFrom(res: Response) {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) {
    return setCookie.map((c) => c.split(";")[0]).join("; ");
  }
  return res.headers.get("set-cookie")?.split(",").map((c) => c.split(";")[0].trim()).join("; ") ?? "";
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
    },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  const cookies = cookieHeaderFrom(res);
  const body = await res.text().catch(() => "");
  let redirectPath: string | null = null;
  if (res.ok && cookies) {
    const redirectRes = await fetch(`${baseUrl}/api/auth/post-login-redirect`, {
      headers: { cookie: cookies },
    });
    const json = (await redirectRes.json().catch(() => ({}))) as { path?: string };
    redirectPath = json.path ?? null;
  }
  return { ok: res.ok && !!cookies, cookies, redirectPath, status: res.status, body: body.slice(0, 160) };
}

async function probePath(cookies: string, path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookies },
    redirect: "follow",
  });
  const finalPath = pathOf(res.url);
  return { status: res.status, finalPath };
}

function isAllowed(requested: string, finalPath: string, status: number) {
  if (status >= 500) return false;
  // Allowed if we stayed on the requested path (or a nested child).
  return finalPath === requested || finalPath.startsWith(`${requested}/`);
}

function isDenied(requested: string, finalPath: string, status: number) {
  if (status === 404 || status === 403) return true;
  // Denied if redirected away from the forbidden path (typically to branch home).
  return !(finalPath === requested || finalPath.startsWith(`${requested}/`));
}

async function main() {
  console.log("BASE_URL:", baseUrl);
  console.log("BRANCH:", branchBase);

  const rows: Row[] = [];

  for (const account of ACCOUNTS) {
    const auth = await signIn(account.email, account.password);
    if (!auth.ok) {
      rows.push({
        role: account.role,
        email: account.email,
        signInOk: false,
        redirect: null,
        urlOk: {
          path: account.urlOk,
          finalPath: "",
          status: 0,
          allowed: false,
        },
        urlKo: {
          path: account.urlKo,
          finalPath: "",
          status: 0,
          denied: false,
        },
        detail: `signIn failed status=${auth.status} body=${auth.body}`,
      });
      continue;
    }

    const okProbe = await probePath(auth.cookies, account.urlOk);
    const koProbe = await probePath(auth.cookies, account.urlKo);

    const urlOkAllowed = isAllowed(account.urlOk, okProbe.finalPath, okProbe.status);
    const urlKoDenied = isDenied(account.urlKo, koProbe.finalPath, koProbe.status);

    rows.push({
      role: account.role,
      email: account.email,
      signInOk: true,
      redirect: auth.redirectPath,
      urlOk: {
        path: account.urlOk,
        finalPath: okProbe.finalPath,
        status: okProbe.status,
        allowed: urlOkAllowed,
      },
      urlKo: {
        path: account.urlKo,
        finalPath: koProbe.finalPath,
        status: koProbe.status,
        denied: urlKoDenied,
      },
      detail: "",
    });
  }

  console.log("\n=== MATRICE URL ===");
  let failures = 0;
  for (const row of rows) {
    const ok = row.signInOk && row.urlOk.allowed && row.urlKo.denied;
    if (!ok) failures += 1;
    console.log(
      JSON.stringify(
        {
          role: row.role,
          email: row.email,
          signInOk: row.signInOk,
          postLogin: row.redirect,
          urlOk: row.urlOk,
          urlKo: row.urlKo,
          PASS: ok,
          detail: row.detail || undefined,
        },
        null,
        2,
      ),
    );
  }

  // Unification check: directeur & préfet same finance outcome
  const dir = rows.find((r) => r.role === "directeur");
  const pref = rows.find((r) => r.role === "préfet");
  if (dir && pref) {
    const same =
      dir.urlOk.allowed === pref.urlOk.allowed &&
      dir.urlKo.denied === pref.urlKo.denied;
    console.log(
      `\nUnification préfet ≡ directeur (finance OK / settings KO): ${same ? "PASS" : "FAIL"}`,
    );
    if (!same) failures += 1;
  }

  console.log(`\nFailures: ${failures}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
