# Index — Unités d'exécution bulletins primaire / secondaire

**Document parent :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md)  
**Dossier :** `context/units/`  
**Généré le :** 13 juillet 2026

## Vue d'ensemble

| Phase | Unité | Titre | Statut |
| --- | --- | --- | --- |
| 1 | [unit-phase-01.md](./unit-phase-01.md) | Audit des limites actuelles | ✅ Terminée |
| 2 | [unit-phase-02.md](./unit-phase-02.md) | Type de branche au contexte | ✅ Terminée |
| 3 | [unit-phase-03.md](./unit-phase-03.md) | Groupes académiques génériques | ✅ Terminée |
| 4 | [unit-phase-04.md](./unit-phase-04.md) | Types et données étendus | ✅ Terminée |
| 5 | [unit-phase-05.md](./unit-phase-05.md) | Stabiliser le secondaire | ✅ Terminée |
| 6 | [unit-phase-06.md](./unit-phase-06.md) | Layout primaire | ✅ Terminée |
| 7 | [unit-phase-07.md](./unit-phase-07.md) | Sélection automatique | ✅ Terminée |
| 8 | [unit-phase-08.md](./unit-phase-08.md) | Tests calculs | ✅ Terminée |
| 9 | [unit-phase-09.md](./unit-phase-09.md) | Tests isolation | ✅ Terminée |
| 10 | [unit-phase-10.md](./unit-phase-10.md) | Contrôle visuel secondaire | ✅ Terminée |
| 11 | [unit-phase-11.md](./unit-phase-11.md) | Contrôle visuel primaire | ✅ Terminée |
| 12 | [unit-phase-12.md](./unit-phase-12.md) | Vérifications techniques | ✅ Terminée |
| 13 | [unit-phase-13.md](./unit-phase-13.md) | Validation finale | ✅ Terminée |

## Phase 1 — vérification

La phase 1 est **confirmée terminée** :

1. Rapport d'audit présent : `context/audit-phase-1-bulletins-primaire-secondaire.md`
2. Aucune modification fonctionnelle effectuée (audit seul)
3. Inspection du code alignée avec les conclusions de l'audit (voir [unit-phase-01.md](./unit-phase-01.md))

**Prochaine action recommandée :** toutes les phases bulletins primaire/secondaire sont terminées.

## Phase 2 — vérification

La phase 2 est **confirmée terminée** :

1. `typebranch` sélectionné côté serveur dans `fiches/page.tsx` (via `organizationId` + `branchId`)
2. `branchType` ajouté à `BulletinBranchContext` et normalisé via `normalizeBranchType`
3. Contexte transmis à `ClassFicheClient` et `useBulletinPDF` via `branchContext`
4. Tests `PRIMAIRE` / `SECONDAIRE` verts dans `scripts/test-bulletin-context.ts`

## Phase 3 — vérification

La phase 3 est **confirmée terminée** :

1. `lib/academic-structure.ts` enrichi : helpers génériques (`getStorageGroupKey`, `buildPeriodFieldMap`, `isAcademicGroupComplete`, etc.)
2. `lib/bulletin-maxima.ts` : `calculateBulletinYearMaxima` boucle sur les groupes (2 secondaire, 3 primaire)
3. `lib/types/index.ts` : `SEM_ORDER`, `getPlaceValue`, totaux et visibilité généralisés via la structure académique
4. `ClassFicheClient.tsx` : calculs TT/TG en boucle sur les groupes selon `branchContext.branchType`
5. Tests verts : `scripts/test-bulletin-maxima.ts`, `scripts/test-bulletin-academic-groups.ts`

## Phase 4 — vérification

La phase 4 est **confirmée terminée** :

1. `ApplicationType` / `TypeFiche` : `sem3` optionnel sur totaux, pourcentages, places, applications, conduite et signatures
2. `TotalKey` inclut `tt3` ; `mapTypeFicheSectionToSubject` propage les 3 groupes vers le moteur PDF
3. `buildEmptySubjectGroupScores` et `getActivePeriodKeys` dans les générateurs PDF (`useBulletinPDF`, `bulletins`)
4. `ClassFicheClient` : agrégation via `buildPeriodFieldMap` et totaux annuels sur tous les groupes
5. Tests verts : `scripts/test-bulletin-extended-data.ts`

## Phase 5 — vérification

La phase 5 est **confirmée terminée** :

1. `lib/bulletin-layout.ts` : helpers communs (`getBulletinFrameWidth`, `scaleRatiosToWidths`, `computeColumnPositions`)
2. `fiches/components/bulletin-secondary-layout.ts` : layout secondaire isolé avec en-tête tableau et positions calculées
3. `useBulletinPDF.tsx` et `bulletins.tsx` : extraction du rendu secondaire, plus de `colRatios` / coordonnées fixes en dur
4. Six cases d'évaluation rééquilibrées (P1, P2, EXAM 1, P3, P4, EXAM 2) ; largeur repechage dérivée de la page
5. Tests verts : `scripts/test-bulletin-layouts.ts` (maxima 1/2/3 chiffres, positions dérivées des largeurs)

## Phase 6 — vérification

La phase 6 est **confirmée terminée** :

1. `fiches/components/bulletin-primary-layout.ts` : layout primaire isolé (3 trimestres, 6 périodes, 3 examens, 3 totaux, TG)
2. `lib/bulletin-layout.ts` : helpers communs réutilisés (`getBulletinFrameWidth`, `scaleRatiosToWidths`, `computeColumnPositions`)
3. Positions recalculées depuis la largeur A4 ; colonnes générales conservées (SIGN PROF, repechage %, signature)
4. Neuf cases d'évaluation rééquilibrées (P1–P6 + EXAM 1–3) sans dépassement horizontal
5. Tests verts : `scripts/test-bulletin-layouts.ts` (layout primaire en plus du secondaire)

## Phase 7 — vérification

La phase 7 est **confirmée terminée** :

1. `resolveBulletinLayoutKind` dans `lib/bulletin-context.ts` : routage automatique PRIMAIRE → primary, repli SECONDAIRE si inconnu
2. `useBulletinPDF.tsx` : sélection du layout selon `branchContext.branchType` (aucun sélecteur manuel)
3. Branche primaire : `bulletin-primary-layout.ts` + `bulletin-primary-render.ts` (en-tête, maxima, matières, généraux)
4. Branche secondaire : comportement inchangé via `bulletin-secondary-layout.ts`
5. Tests verts : `scripts/test-bulletin-context.ts` (résolution du layout kind)

## Phase 8 — vérification

La phase 8 est **confirmée terminée** :

1. `scripts/test-bulletin-calculations.ts` : 22 tests couvrant secondaire, primaire et cas limites
2. Secondaire : 4 périodes, 2 examens, TT1/TT2, TG, maxima dynamiques agrégés
3. Primaire : 6 périodes, 3 examens, TT1/TT2/TT3, TG, maxima dynamiques sur 3 trimestres
4. Cas limites : anciennes fiches, périodes manquantes, pondération de secours, maxima à 3 chiffres, pondérations mixtes
5. Aucun `NaN` ni division par zéro ; formules secondaire inchangées (`computeTotSem1` / `computeTotSem2`)
6. Scripts : `pnpm test:bulletin-calculations` et `pnpm test:bulletin` (suite complète)

## Phase 9 — vérification

La phase 9 est **confirmée terminée** :

1. `scripts/test-bulletin-isolation.ts` : 12 tests couvrant sélection de layout et isolation des branches
2. Org A : branche primaire → layout `primary` ; branche secondaire → layout `secondary`
3. Filtre `organizationId + branchId` vérifié (refus cross-org et branchId inconnu)
4. Session prioritaire sur `branchId` d'URL ; `typebranch` client ignoré (type serveur via `buildBulletinBranchContext`)
5. En-têtes distincts par branche : nom, adresse, logo (branche prioritaire sur organisation)
6. Scripts : `pnpm test:bulletin-isolation` et `pnpm test:bulletin` (suite complète)

## Phase 10 — vérification

La phase 10 est **confirmée terminée** :

1. `scripts/test-bulletin-visual-secondary.ts` : 9 contrôles de mise en page secondaire
2. Bulletin individuel généré : `context/samples/phase-10/bulletin-secondaire-individuel.pdf`
3. Export classe (3 élèves) : `context/samples/phase-10/bulletin-secondaire-classe.pdf`
4. Six cases d'évaluation (P1, P2, EXAM 1, P3, P4, EXAM 2) équilibrées et ≥ 8,5 mm
5. Maxima à 1, 2 et 3 chiffres lisibles dans chaque case d'évaluation
6. Aucun débordement horizontal A4 ; bas de page (signatures) dans les limites de la page
7. Colonnes latérales présentes : TG, SIGN PROF, repechage % / signature
8. Logique inchangée : 4 périodes, 2 examens, TOTAL 1 / TOTAL 2 / TG
9. Scripts : `pnpm test:bulletin-visual-secondary` et `pnpm test:bulletin` (suite complète)

## Phase 11 — vérification

La phase 11 est **confirmée terminée** :

1. `scripts/test-bulletin-visual-primary.ts` : 12 contrôles de mise en page primaire
2. Bulletin individuel généré : `context/samples/phase-11/bulletin-primaire-individuel.pdf`
3. Export classe (3 élèves) : `context/samples/phase-11/bulletin-primaire-classe.pdf`
4. Neuf cases d'évaluation (P1–P6 + EXAM 1–3) équilibrées et ≥ 8,5 mm
5. Trois totaux trimestriels (TOTAL 1, TOTAL 2, TOTAL 3) et TG lisibles
6. Aucun débordement horizontal A4 ; bas de page (signatures) dans les limites de la page
7. Colonnes latérales présentes : TG, SIGN PROF, repechage % / signature
8. Identité visuelle alignée sur le secondaire (marges, frame 190 mm, min case)
9. Format portrait conservé — pas de bascule paysage nécessaire
10. Scripts : `pnpm test:bulletin-visual-primary` et `pnpm test:bulletin` (suite complète)

## Phase 12 — vérification

La phase 12 est **confirmée terminée** :

1. TypeScript : `pnpm exec tsc --noEmit` — zéro erreur (corrections dans `ClassFicheClient.tsx` et `filterPeriodsForGroup`)
2. Lint : `pnpm lint` — aucune erreur (avertissements a11y/img préexistants hors périmètre bulletin)
3. Tests maxima : `pnpm test:bulletin-maxima` — 19 tests verts
4. Tests layouts + type de branche : `pnpm test:bulletin-layouts`, `pnpm test:bulletin-context` — verts
5. Suite complète : `pnpm test:bulletin` — 121 tests verts (maxima, contexte, groupes, données, layouts, calculs, isolation, visuels)
6. Build production : `pnpm build` — réussi
7. Duplication supprimée : `bulletins.tsx` retiré (non importé ; seul `useBulletinPDF.tsx` gère primaire et secondaire)
8. Scripts : `pnpm test:bulletin`, `pnpm build`

## Phase 13 — vérification

La phase 13 est **confirmée terminée** :

1. **Routage automatique** : `resolveBulletinLayoutKind` dans `lib/bulletin-context.ts` — PRIMAIRE → `primary`, SECONDAIRE → `secondary` (repli si type inconnu)
2. **Branche secondaire** : layout `bulletin-secondary-layout.ts` uniquement — 4 périodes, 2 examens, TOTAL 1 / TOTAL 2 / TG
3. **Branche primaire** : layout `bulletin-primary-layout.ts` uniquement — 6 périodes, 3 examens, TOTAL 1–3 / TG
4. **Structure académique** : `lib/academic-structure.ts` — chaque groupe de deux périodes se termine par son examen (2 groupes secondaire, 3 groupes primaire)
5. **Maxima dynamiques** : priorité au `maxScore` enregistré dans la fiche ; pondération en secours uniquement
6. **Anciennes fiches** : compatibles (données partielles, maxima historiques conservés)
7. **Classement et appréciations** : `getPlaceValue`, APPLICATIONS, CONDUITE — structure 2 ou 3 trimestres selon le type de branche
8. **Lisibilité A4** : contrôles visuels phases 10 et 11 — aucun débordement horizontal, cases ≥ 8,5 mm
9. **Aucun choix manuel** : `useBulletinPDF.tsx` sélectionne le layout via `branchContext.branchType` (type serveur)
10. **Isolation** : filtre `organizationId` + `branchId` ; typebranch client ignoré
11. **Livrables présents** : `bulletin-context.ts`, `academic-structure.ts`, layouts primaire/secondaire, `useBulletinPDF.tsx`
12. **Suite complète** : `pnpm test:bulletin` — 121 tests verts ; `pnpm exec tsc --noEmit` — zéro erreur ; `pnpm build` — réussi
13. **Échantillons PDF** : `context/samples/phase-10/` (secondaire), `context/samples/phase-11/` (primaire)

## Chaîne de dépendances

```text
Phase 1 (audit) ✅
    └── Phase 2 (contexte branchType) ✅
            └── Phase 3 (groupes académiques) ✅
                    └── Phase 4 (données étendues) ✅
                            ├── Phase 5 (layout secondaire) ✅
                            └── Phase 6 (layout primaire) ✅
                                    └── Phase 7 (routage auto) ✅
                                            ├── Phase 8 (tests calculs) ✅
                                            ├── Phase 9 (tests isolation) ✅
                                            ├── Phase 10 (visuel secondaire) ✅
                                            └── Phase 11 (visuel primaire) ✅
                                                    └── Phase 12 (technique) ✅
                                                            └── Phase 13 (validation) ✅
```
