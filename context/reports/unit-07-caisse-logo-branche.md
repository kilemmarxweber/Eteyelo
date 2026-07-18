# Unit 07 — Caisse : logo branche → org

## Objectif

Aligner le PDF caisse sur la résolution logo branche puis organisation.

## Dépendances

- Unit 00

## Portée

- `.../paiement/components/export-cashier-pdf.ts`
- `getCashierReportContextAction` dans `paiement.action.ts`
- évent. `CashierReport.tsx`

## Actions

1. Context : `branch.image.logo` → `organization.logo`.
2. Remplacer helpers locaux par kit `lib/reports/*`.
3. Vérifier header (nom branche, période, totaux inchangés).

## Hors scope

- Solde d’ouverture caisse.
- Rapport impayés (→ unit 09).

## Tests manuels

- Export caisse avec logo branche.
- Fallback org si pas de logo branche.

## DoD

- Même règle logo que students/schedule.
- `tsc` OK.
