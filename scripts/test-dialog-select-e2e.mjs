/**
 * E2E Playwright — Dialog + Select (page /dev/portal-dismiss-test).
 * Usage: node scripts/test-dialog-select-e2e.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PAGE_URL = `${BASE_URL}/dev/portal-dismiss-test`;

async function assertDialogOpen(page) {
  await page.waitForSelector('[data-testid="dialog-content"]', {
    state: "visible",
    timeout: 8000,
  });
  const state = await page.locator('[data-testid="dialog-state"]').textContent();
  if (!state?.includes("open")) {
    throw new Error(`Dialog attendu ouvert, état: ${state}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`→ ${PAGE_URL}`);
    await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 30000 });

    // 1. Ouvrir le dialog
    await page.click('[data-testid="open-dialog"]');
    await assertDialogOpen(page);
    console.log("✓ Dialog s’ouvre");

    // 2. Ouvrir le select niveau puis fermer avec Escape (sans choisir)
    await page.click('[data-testid="level-trigger"]');
    await page.waitForSelector('[data-testid="level-1p"]', { state: "visible" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await assertDialogOpen(page);
    console.log("✓ Dialog reste ouvert après ouverture/fermeture du select sans choix");

    // 3. Sélectionner un niveau
    await page.click('[data-testid="level-trigger"]');
    await page.click('[data-testid="level-1p"]');
    await page.waitForTimeout(400);
    await assertDialogOpen(page);
    const level = await page.locator('[data-testid="level-value"]').textContent();
    if (!level?.includes("1P")) {
      throw new Error(`Niveau non sélectionné: ${level}`);
    }
    console.log("✓ Dialog reste ouvert après sélection niveau");

    // 4. Sélectionner une section
    await page.click('[data-testid="section-trigger"]');
    await page.click('[data-testid="section-sci"]');
    await page.waitForTimeout(400);
    await assertDialogOpen(page);
    const section = await page
      .locator('[data-testid="section-value"]')
      .textContent();
    if (!section?.includes("sci")) {
      throw new Error(`Section non sélectionnée: ${section}`);
    }
    console.log("✓ Dialog reste ouvert après sélection section");

    // 5. Changer de niveau (reset section)
    await page.click('[data-testid="level-trigger"]');
    await page.click('[data-testid="level-2p"]');
    await page.waitForTimeout(400);
    await assertDialogOpen(page);
    console.log("✓ Dialog reste ouvert après changement de niveau");

    // 6. Simuler menu ⋯ → ouverture dialog (pattern colonnes classe)
    await page.click('[data-testid="open-dialog"]');
    await assertDialogOpen(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.click('[data-testid="open-dialog"]');
    await assertDialogOpen(page);
    console.log("✓ Réouverture dialog après Escape OK");

    console.log("\nTous les tests E2E Dialog + Select sont passés.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("\n✗ Échec E2E:", error.message ?? error);
  process.exit(1);
});
