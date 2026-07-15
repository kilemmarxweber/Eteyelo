# Rapport de validation — Bulletin primaire v2

**Date :** 14 juillet 2026  
**Plan :** `context/primaireUnit/plan-execution.md`

## Résumé

Le bulletin primaire a été refondu selon le modèle RDC (grille 21 cellules, domaines, MAX | PTS OBT).

| Phase | Statut | Livrable |
| --- | --- | --- |
| 1 — Géométrie | ✅ | `bulletin-primary-layout.ts`, `lib/primary-bulletin-columns.ts` |
| 2 — En-tête | ✅ | `BRANCHES`, colonnes plates, `TOTAL` → `MAX \| PTS OBT` |
| 3 — Notes cours | ✅ | `drawPrimaryMatiere()` sur `evalCells` |
| 4 — Maxima | ✅ | `buildPrimaryMaximaValues()`, lignes sous-total + général |
| 5 — Domaines | ✅ | `lib/primary-domains.ts`, `buildPrimaryBulletinRows()` |
| 6 — Générales | ✅ | `drawPrimarySubjectRow()` adapté |
| 7 — Tests | ✅ | layouts, visuel, calculs, isolation |
| 8 — Doc | ✅ | ce rapport |

## Fichiers modifiés

- `lib/primary-bulletin-columns.ts` *(nouveau)*
- `lib/primary-domains.ts` *(nouveau)*
- `lib/bulletin-maxima.ts` — `computeTrimesterMaxima`, `computeYearMaxima`
- `bulletin-primary-layout.ts` — refonte complète
- `bulletin-primary-render.ts` — refonte complète
- `useBulletinPDF.tsx` — pipeline domaines primaire
- `scripts/test-bulletin-layouts.ts`
- `scripts/test-bulletin-visual-primary.ts`

## Tests exécutés

```bash
pnpm tsx scripts/test-bulletin-layouts.ts          # OK
pnpm tsx scripts/test-bulletin-visual-primary.ts   # OK
pnpm tsx scripts/test-bulletin-calculations.ts     # OK
pnpm tsx scripts/test-bulletin-isolation.ts        # OK
```

## Points notables

1. **21 cellules** sur A4 portrait : seuil minimum abaissé à `PRIMARY_MIN_EVAL_CELL_WIDTH_MM = 6.5`.
2. **Domaines** : catalogue dans `PRIMARY_COURSE_CATALOG` ; cours non mappés → `DEVELOPPEMENT / AUTRES COURS`.
3. **UI admin** (sélecteur domaine sur `cours-form`) : non implémenté — mapping par nom pour l'instant.
4. **Secondaire** : inchangé (isolation confirmée).

## PDF échantillons

Générés dans `context/samples/phase-11/` :
- `bulletin-primaire-individuel.pdf`
- `bulletin-primaire-classe.pdf`

## Suite recommandée

- Compléter le catalogue domaines 3–5 quand le bulletin complet est disponible.
- Migration Prisma `primaryDomain` sur `Cours` + UI admin.
- Test manuel sur une fiche réelle en production.
