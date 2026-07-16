import assert from "node:assert/strict";

import {
  markRadixPortalInteraction,
  shouldPreventDismissOutside,
} from "../lib/radix-portal-dismiss";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("markRadixPortalInteraction bloque le dismiss (sans cible DOM)", () => {
  markRadixPortalInteraction(500);
  assert.equal(shouldPreventDismissOutside(null), true);
});

test("sans marquage récent, null target ne bloque pas seul", () => {
  // Attendre la fin de la fenêtre précédente
  const start = Date.now();
  while (Date.now() - start < 550) {
    // busy wait court pour tests synchrones
  }
  assert.equal(shouldPreventDismissOutside(null), false);
});

console.log("\nTests unitaires radix-portal-dismiss OK.");
