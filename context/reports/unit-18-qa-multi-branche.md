# Unit 18 — QA multi-branche & polish print

## Objectif

Valider bout-en-bout le lot P0 (+ P1 faits) sur 2 établissements ; corriger les écarts print.

## Dépendances

- Units 01–07 minimum (P0)
- Units P1 réalisées à ce stade

## Portée

- Pas de nouvelle feature ; correctifs ciblés (marges, contrastes, logos manquants, hardcodes restants)

## Checklist

- [x] Branche A avec logo → reçu, élèves, enseignants, caisse, effectifs : logo A
- [x] Branche B sans logo → pas d’erreur ; nom correct
- [x] Filtre genre / classe → PDF cohérent
- [x] Reçu : zéro « Marguerite » / adresse fantôme
- [x] Aperçu reçu ≈ PDF
- [x] Impression A4 sans coupure critique
- [x] `/rapport` PDF brandé
- [x] Rôle non autorisé → refus serveur
- [x] Grep anti-régression : `MARGUERITE`, `MON ÉCOLE`, `/cmj.jpg`, taux FX magiques dans PDF

## Actions

1. Exécuter la checklist sur 2 branches.
2. Corriger les bugs trouvés (petits PR / commits ciblés).
3. Noter les units P2 restantes non faites.

## DoD

- Checklist P0 verte.
- `tsc` + `lint` + `build` OK.

## Livré (2026-07-18)

### QA (script `scripts/qa-reports-multi-branch.ts`)

| Branche | id | Logo | Nom |
|---|---|---|---|
| A — Ecole primaire | `cmrg3lka20000c4tmkgy8z04u` | `/uploads/…-splash-icon.png` | Eteyelo Demo |
| B — Kinshasa Centre | `cmr6j3s2l00002ctmqbtqqvav` | absent | Eteyelo Demo (sans erreur) |

- Anti-régression PDF : OK (pas de `MARGUERITE` / `MON ÉCOLE` / `/cmj.jpg` / `2800` littéral hors `DEFAULT_*`).
- Filtres élèves → titres PDF cohérents.
- Auth contextes : `guardOrganizationAccess` (`/rapport`), `canManageOrganization` (caisse / impayés / reçu), `canAccessResultsArea`, teachers gated.

### Correctifs print

- Reçu : suppression hardcode « Fait à Kinshasa » → `issuedPlace` = `branch.ville` (aperçu + PDF alignés).
- `SchoolReportContext.city` peuplé depuis `branch.ville`.
- Refuse serveur renforcé sur contexts finance PDF.
- Build : `resolveUnpaidFinancialStatus` non exporté (sync interdit dans `"use server"`).

### Validation

- `npx tsc --noEmit` OK
- `npm run lint` OK
- `npm run build` OK
- `npx tsx scripts/qa-reports-multi-branch.ts` OK

### Units P2 restantes

- **Aucune** : units 15 (horaire), 16 (fiche notes), 17 (classement) déjà branchées sur le kit branding.
- Unit 14 bulletins : **hors scope** (exclue volontairement).

### Note tooling

- `next-dev-loop` non applicable ici : Next **15.4.2** (< 16.3 requis pour `/_next/mcp` + Turbopack probe). QA via script Prisma + smoke jsPDF.
