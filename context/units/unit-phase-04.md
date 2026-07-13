# Unité — Phase 4 : Étendre les types et données du bulletin

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** [unit-phase-03.md](./unit-phase-03.md)  
**Statut :** ✅ Terminée (13 juillet 2026)

## Objectif

Faire circuler toutes les données du primaire (6 périodes, 3 examens, 3 totaux) jusqu'au moteur PDF, tout en préservant les fiches secondaires existantes.

## Tâches

- [x] Ajouter `p5`, `p6`, `exam3` et `total3` aux structures nécessaires
- [x] Étendre les champs généraux du primaire : totaux, pourcentages, places, applications, conduite, signatures
- [x] Préserver la compatibilité des anciennes fiches secondaires
- [x] Gérer les périodes absentes sans produire `NaN` ou division par zéro

## Résultat attendu

Les données du primaire arrivent entièrement jusqu'au moteur PDF.

## Vérification effectuée (13 juillet 2026)

| Élément | Statut |
| --- | --- |
| Clés `p5`, `p6`, `exam3` dans les types | ✅ `lib/types/index.ts`, `lib/bulletin-maxima.ts` |
| `Subject.sem3` optionnel | ✅ Existe |
| `TotalKey` avec `tt3` | ✅ `tt1`, `tt2`, `tt3`, `tg` |
| `ApplicationType` / conduite pour 3 groupes | ✅ `sem3` optionnel sur toutes les sections TypeFiche |
| Agrégation complète dans `ClassFicheClient` | ✅ `buildPeriodFieldMap` + boucle sur groupes |
| Collecte dans les générateurs PDF | ✅ `getActivePeriodKeys`, `buildEmptySubjectGroupScores`, `mapTypeFicheSectionToSubject` |
| Tests automatisés | ✅ `scripts/test-bulletin-extended-data.ts` |

## Fichiers concernés

- `lib/types/index.ts`
- `lib/bulletin-maxima.ts`
- `lib/academic-structure.ts`
- `app/admin/.../fiches/components/ClassFicheClient.tsx`
- `app/admin/.../fiches/components/useBulletinPDF.tsx`
- `app/admin/.../fiches/components/bulletins.tsx`

## Critères d'acceptation

- [x] Bulletin primaire : `total1 + total2 + total3 = total général`
- [x] Fiches anciennes sans 3ᵉ trimestre : affichage correct, pas d'erreur
- [x] Période manquante → valeur neutre (0 ou vide), pas de `NaN`

## Prochaine étape

→ [unit-phase-05.md](./unit-phase-05.md) — Stabiliser le bulletin secondaire
