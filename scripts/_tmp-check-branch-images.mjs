import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT id, name, image, "updatedAt"
  FROM "Branch"
  WHERE "isActive" = true
  ORDER BY "updatedAt" DESC NULLS LAST
  LIMIT 12
`);

for (const row of rows) {
  const image = row.image ?? {};
  console.log(
    JSON.stringify(
      {
        id: row.id,
        name: row.name,
        logo: image.logo ?? "",
        ecole: image.ecole ?? [],
        gallery: image.gallery ?? [],
        event: image.event ?? [],
      },
      null,
      2,
    ),
  );
}

await client.end();
