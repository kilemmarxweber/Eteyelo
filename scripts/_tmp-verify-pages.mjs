const urls = [
  "http://localhost:3000/etablissements/cmrrmlp4x000afel3ob5x6x6m",
  "http://localhost:3000/etablissements/cmta69869001gp4vr9x51p8kz",
];

for (const url of urls) {
  const res = await fetch(url);
  const html = await res.text();
  console.log(
    JSON.stringify(
      {
        url,
        status: res.status,
        emptyGallery: html.includes("Aucune galerie"),
        hasEcoleFile: html.includes("1788418182725"),
        hasMissingSanta: html.includes("178445528"),
        hasCoverBg: html.includes("background-image"),
      },
      null,
      2,
    ),
  );
}
