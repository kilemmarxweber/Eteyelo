/**
 * Empêche Dialog/Sheet de se fermer quand on interagit avec un portal Radix
 * (Select, Popover, Dropdown, Command…).
 *
 * Cas critique : après un choix dans un Select, le portal est déjà démonté
 * quand `onInteractOutside` / `onFocusOutside` part — le target n’est plus
 * dans le Select. On garde donc une courte fenêtre d’ignorance du dismiss.
 *
 * Note : `@radix-ui/react-select` n’expose PAS `data-radix-select-content`.
 * Le viewport a `data-radix-select-viewport`, le popper a
 * `data-radix-popper-content-wrapper`, et les items ont `role="option"`.
 */

let ignoreDismissUntil = 0;

/** À appeler au pointerdown / au démontage d’un contenu portail. */
export function markRadixPortalInteraction(ms = 500): void {
  ignoreDismissUntil = Math.max(ignoreDismissUntil, Date.now() + ms);
}

export function isRadixPortaledTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest("[data-eteyelo-portal]") ||
      target.closest("[data-radix-select-viewport]") ||
      target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-radix-dropdown-menu-content]") ||
      target.closest("[data-radix-dropdown-menu-sub-content]") ||
      target.closest("[data-radix-popover-content]") ||
      target.closest("[data-radix-combobox-content]") ||
      target.closest("[cmdk-root]") ||
      target.closest("[cmdk-list]") ||
      target.closest("[cmdk-item]") ||
      target.closest("[cmdk-input-wrapper]") ||
      target.closest("[role='listbox']") ||
      target.closest("[role='option']"),
  );
}

/** True s’il existe encore un overlay portail ouvert dans le document. */
function hasOpenRadixPortal(): boolean {
  if (typeof document === "undefined") return false;

  return Boolean(
    document.querySelector("[data-eteyelo-portal]") ||
      document.querySelector("[data-radix-select-viewport]") ||
      document.querySelector("[data-radix-popper-content-wrapper]") ||
      document.querySelector("[data-radix-popover-content]") ||
      document.querySelector("[data-radix-dropdown-menu-content]") ||
      document.querySelector("[cmdk-root]"),
  );
}

/** Utiliser dans onPointerDownOutside / onInteractOutside / onFocusOutside. */
export function shouldPreventDismissOutside(
  target: EventTarget | null,
): boolean {
  if (Date.now() < ignoreDismissUntil) return true;
  if (isRadixPortaledTarget(target)) return true;
  if (hasOpenRadixPortal()) return true;
  return false;
}

/** Ouvre un Dialog/Sheet après fermeture du menu ⋯ sans refresh ni perte de focus. */
export function openOverlayAfterMenuDismiss(open: () => void, ms = 400): void {
  markRadixPortalInteraction(ms);
  requestAnimationFrame(() => {
    open();
  });
}
