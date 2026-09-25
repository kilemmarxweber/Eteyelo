import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT id, name, image
  FROM "Branch"
  WHERE "isActive" = true
`);

const dirs = [
  "C:/eteyelo-uploads",
  "C:/Users/kilemmarxweber/Desktop/Eteyelo/public/uploads",
];

function exists(name) {
  if (!name) return false;
  const raw = String(name).split("?")[0];
  const base = path.basename(raw.replace(/^.*(?:uploads\/)/, ""));
  return dirs.some((d) => fs.existsSync(path.join(d, base)));
}

let logoOk = 0;
let logoMiss = 0;
let photoOk = 0;
let photoMiss = 0;
const missing = [];

for (const row of rows) {
  const img = row.image || {};
  if (img.logo) {
    if (exists(img.logo)) logoOk += 1;
    else {
      logoMiss += 1;
      missing.push({ branch: row.name, type: "logo", file: img.logo });
    }
  }
  for (const type of ["ecole", "gallery", "event"]) {
    for (const f of img[type] || []) {
      if (exists(f)) photoOk += 1;
      else {
        photoMiss += 1;
        missing.push({ branch: row.name, type, file: f });
      }
    }
  }
}

console.log(
  JSON.stringify(
    { logoOk, logoMiss, photoOk, photoMiss, missingCount: missing.length, missing },
    null,
    2,
  ),
);

await client.end();
