# Unit 02 — Reçu : branding + logo dynamique

## Objectif

Rendre le reçu multi-établissement : nom, adresse, logo branche (plus de hardcode Marguerite).

## Dépendances

- Unit 00

## Portée

- `components/FacturePaymentStudent.tsx`
- `.../paiement/paiement.action.ts` (payload `receipt` / `sender`)
- `PaymentsForm.tsx` (passage `logoUrl` / dataURL)

## Actions

1. `sender.name` = nom branche (ou org) ; `sender.address` = adresse réelle.
2. Injecter `logoUrl` (branche → org) dans le payload.
3. Convertir en dataURL avant `doc.addImage`.
4. Remplacer titre hardcodé par `schoolName` / `sender.name`.
5. Remplacer taux FX hardcodé `2800` par valeur context (ou config existante).
6. Ne pas casser le téléchargement PDF post-paiement.

## Hors scope

- Aperçu HTML WYSIWYG (→ unit 03).
- Unification Invoice historique (→ unit 03).

## Tests manuels

- Paiement → PDF reçu : nom = établissement courant.
- Logo branche présent → logo sur PDF.
- Logo absent → PDF sans erreur.
- Aucune chaîne « MARGUERITE » dans le PDF.

## DoD

- Zéro hardcode établissement de démo dans le générateur reçu.
- Logo dynamique opérationnel.
- `tsc` OK.
