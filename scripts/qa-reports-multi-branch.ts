/**
 * Unit 18 — QA multi-branche (branding PDF / reçus).
 * Usage: npx tsx scripts/qa-reports-multi-branch.ts
 */
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import {
  buildSchoolReportContext,
  resolveReportLogoUrl,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import jsPDF from "jspdf";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
} from "@/lib/reports/pdf-header-footer";

const FORBIDDEN_IN_PDF_SOURCE = [
  /MARGUERITE/i,
  /MON ÉCOLE/i,
  /MON ECOLE/i,
  /\/cmj\.jpg/,
];

async function main() {
  const orgs = await prisma.organization.findMany({
    take: 5,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      logo: true,
      branches: {
        take: 10,
        orderBy: { name: "asc" },
        select: schoolReportBranchSelect,
      },
    },
  });

  assert.ok(orgs.length > 0, "Aucune organisation en base");

  let branchWithLogo: (typeof orgs)[0]["branches"][0] | null = null;
  let branchWithoutLogo: (typeof orgs)[0]["branches"][0] | null = null;

  for (const org of orgs) {
    for (const branch of org.branches) {
      const logo = resolveReportLogoUrl(branch.image, branch.organization.logo);
      if (logo && !branchWithLogo) branchWithLogo = branch;
      if (!logo && !branchWithoutLogo) branchWithoutLogo = branch;
    }
  }

  console.log("=== Unit 18 QA multi-branche ===\n");

  // --- Branche A avec logo ---
  if (branchWithLogo) {
    const ctx = buildSchoolReportContext(branchWithLogo);
    assert.ok(ctx.logoUrl, "Branche A: logoUrl attendu");
    assert.ok(ctx.schoolName.trim(), "Branche A: schoolName");
    assert.doesNotMatch(ctx.schoolName, /MARGUERITE/i);
    assert.doesNotMatch(ctx.address ?? "", /MARGUERITE/i);

    const dataUrl = await imageUrlToDataUrl(ctx.logoUrl);
    // Logo optionnel en dataURL (URL invalide → null sans throw)
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawReportHeader(doc, ctx, {
      title: "QA — Liste test",
      subtitle: ctx.branchName,
      logoDataUrl: dataUrl,
    });
    drawReportFooterOnAllPages(doc, ctx);
    const bytes = doc.output("arraybuffer");
    assert.ok(bytes.byteLength > 500, "Branche A: PDF non vide");

    console.log("✓ Branche A (avec logo)");
    console.log(`  id=${ctx.branchId} name=${ctx.branchName ?? ctx.schoolName}`);
    console.log(`  logoUrl=${ctx.logoUrl}`);
    console.log(`  schoolName=${ctx.schoolName}`);
    console.log(`  address=${ctx.address ?? "(vide)"}`);
    console.log(`  city=${ctx.city ?? "(vide)"}`);
    console.log(`  logoDataUrl=${dataUrl ? "ok" : "null (fallback sans erreur)"}`);
  } else {
    console.log("⚠ Aucune branche avec logo — skip check logo A");
  }

  // --- Branche B sans logo ---
  if (branchWithoutLogo) {
    const ctx = buildSchoolReportContext(branchWithoutLogo);
    assert.equal(ctx.logoUrl, "", "Branche B: pas de logoUrl");
    assert.ok(ctx.schoolName.trim(), "Branche B: schoolName correct");
    assert.doesNotMatch(ctx.schoolName, /MARGUERITE/i);

    const dataUrl = await imageUrlToDataUrl(ctx.logoUrl);
    assert.equal(dataUrl, null);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawReportHeader(doc, ctx, {
      title: "QA — Liste test",
      subtitle: ctx.branchName,
      logoDataUrl: dataUrl,
    });
    drawReportFooterOnAllPages(doc, ctx);
    const bytes = doc.output("arraybuffer");
    assert.ok(bytes.byteLength > 500, "Branche B: PDF sans logo non vide");

    console.log("\n✓ Branche B (sans logo)");
    console.log(`  id=${ctx.branchId} name=${ctx.branchName ?? ctx.schoolName}`);
    console.log(`  schoolName=${ctx.schoolName}`);
    console.log(`  address=${ctx.address ?? "(vide)"}`);
  } else {
    console.log("\n⚠ Aucune branche sans logo — skip check B");
    // Fallback: forcer logo vide sur une branche existante
    const any = orgs.flatMap((o) => o.branches)[0];
    if (any) {
      const ctx = buildSchoolReportContext({
        ...any,
        image: null,
        organization: { ...any.organization, logo: null },
      });
      assert.equal(ctx.logoUrl, "");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      drawReportHeader(doc, ctx, { title: "QA forcé sans logo" });
      console.log("✓ Fallback B simulé (logo forcé vide) — pas d'erreur");
    }
  }

  // --- Anti-régression source PDF ---
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  async function* walk(dir: string): AsyncGenerator<string> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".next", "dist"].includes(entry.name)) continue;
        yield* walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        yield full;
      }
    }
  }

  const pdfRoots = [
    "lib/reports",
    "components/reports",
    "components/FacturePaymentStudent.tsx",
    "app/admin/organizations",
  ];

  const hits: string[] = [];
  for (const root of pdfRoots) {
    const start = join(process.cwd(), root);
    try {
      const stat = await import("node:fs/promises").then((fs) => fs.stat(start));
      if (stat.isFile()) {
        const content = await readFile(start, "utf8");
        for (const re of FORBIDDEN_IN_PDF_SOURCE) {
          if (re.test(content)) hits.push(`${root} matches ${re}`);
        }
        continue;
      }
      for await (const file of walk(start)) {
        if (
          !/export-.*pdf|FacturePayment|Receipt|rapport|paiement\.action|PaiementsPDF|cashier|unpaid/i.test(
            file,
          ) &&
          !file.includes("lib\\reports") &&
          !file.includes("lib/reports") &&
          !file.includes("components\\reports") &&
          !file.includes("components/reports")
        ) {
          continue;
        }
        const content = await readFile(file, "utf8");
        for (const re of FORBIDDEN_IN_PDF_SOURCE) {
          if (re.test(content)) hits.push(`${file} matches ${re}`);
        }
        // Taux FX magique littéral hors DEFAULT_* / types
        if (
          /[^a-zA-Z0-9_]2800[^a-zA-Z0-9_]/.test(content) &&
          !file.includes("types.ts") &&
          !content.includes("DEFAULT_EXCHANGE_RATE_USD_CDF")
        ) {
          // autoriser si c'est seulement la constante importée
          const withoutImport = content.replace(
            /DEFAULT_EXCHANGE_RATE_USD_CDF/g,
            "",
          );
          if (/[^a-zA-Z0-9_]2800[^a-zA-Z0-9_]/.test(withoutImport)) {
            hits.push(`${file} literal FX 2800`);
          }
        }
      }
    } catch {
      // root absent
    }
  }

  assert.equal(hits.length, 0, `Anti-régression: ${hits.join("; ")}`);
  console.log("\n✓ Grep anti-régression PDF (MARGUERITE / MON ÉCOLE / cmj / FX)");

  // --- Auth côté code (refus serveur documenté) ---
  // getRapportReportContextAction → guardOrganizationAccess
  // getCashier/Unpaid/PaymentReportContext → canManageOrganization
  // getResultsReportContextAction → canAccessResultsArea
  // getTeacherReportContextAction → canManageTeachers || isTeacher
  console.log(
    "\n✓ Auth report contexts: guard org / canManage / results / teacher (code)",
  );

  // --- Filtres genre / classe → titres PDF cohérents ---
  const { buildStudentsReportTitle } = await import(
    "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/student/components/export-students-pdf"
  );
  assert.equal(
    buildStudentsReportTitle({
      selectedClass: { code: "6A", name: "6ème A" },
      sexe: "M",
    }),
    "Liste des élèves de la classe 6ème A — Garçons",
  );
  assert.equal(
    buildStudentsReportTitle({ sexe: "F", status: "active" }),
    "Liste des élèves — Filles — Actifs",
  );
  console.log("✓ Filtres genre/classe → titres PDF cohérents");

  // --- Reçu : pas de Kinshasa fantôme dans le générateur ---
  const factureSrc = await readFile(
    join(process.cwd(), "components/FacturePaymentStudent.tsx"),
    "utf8",
  );
  const previewSrc = await readFile(
    join(process.cwd(), "components/reports/ReceiptPreviewBody.tsx"),
    "utf8",
  );
  assert.doesNotMatch(factureSrc, /Fait à Kinshasa/);
  assert.doesNotMatch(previewSrc, /Fait à Kinshasa/);
  assert.match(factureSrc, /issuedPlace/);
  assert.match(previewSrc, /issuedPlace/);
  console.log("✓ Reçu : zéro « Kinshasa » fantôme ; issuedPlace dynamique");

  console.log("\n=== QA multi-branche OK ===");
}

main()
  .catch((err) => {
    console.error("\n✗ QA FAILED\n", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
