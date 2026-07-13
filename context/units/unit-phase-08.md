# Unité — Phase 8 : Tests fonctionnels des calculs

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** [unit-phase-03.md](./unit-phase-03.md), [unit-phase-04.md](./unit-phase-04.md)  
**Statut :** ✅ Terminée

## Objectif

Valider automatiquement les calculs de maxima, totaux et pourcentages pour les deux formats de bulletin.

## Tâches — Secondaire

- [x] 4 périodes (`p1`–`p4`)
- [x] 2 examens (`exam1`, `exam2`)
- [x] 2 totaux de semestre (`total1`, `total2`)
- [x] Total général (`tg`)
- [x] Maxima dynamiques (jamais depuis un profil statique)

## Tâches — Primaire

- [x] 6 périodes (`p1`–`p6`)
- [x] 3 examens (`exam1`–`exam3`)
- [x] 3 totaux de trimestre (`total1`, `total2`, `total3`)
- [x] Total général (`tg`)
- [x] Maxima dynamiques

## Tâches — Cas limites

- [x] Anciennes fiches (données partielles)
- [x] Périodes manquantes
- [x] Maxima absents (pondération en secours)
- [x] Maxima à trois chiffres
- [x] Plusieurs pondérations dans le même bulletin

## Résultat attendu

Calculs automatisés réussis pour les deux types.

## Scripts existants

- `scripts/test-bulletin-maxima.ts`
- `scripts/test-bulletin-context.ts`

## Scripts créés / étendus

- `scripts/test-bulletin-calculations.ts` — suite dédiée phase 8 (22 tests)
- `scripts/test-bulletin-layouts.ts` (layouts séparés en phase 5–6)
- `pnpm test:bulletin` — exécute l'ensemble des scripts bulletin

## Critères d'acceptation

- [x] Tous les tests passent en CI locale (`pnpm test:bulletin`)
- [x] Aucun `NaN` ni division par zéro sur cas limites
- [x] Secondaire : formules inchangées par rapport à l'existant

## Prochaine étape

→ [unit-phase-09.md](./unit-phase-09.md) — Tests de sélection et d'isolation
