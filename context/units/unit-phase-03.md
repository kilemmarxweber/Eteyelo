# Unité — Phase 3 : Généraliser les groupes académiques

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** [unit-phase-02.md](./unit-phase-02.md)  
**Statut :** ✅ Terminée (13 juillet 2026)

## Objectif

Remplacer la logique codée en dur pour deux semestres par une représentation générique pilotée par `lib/academic-structure.ts`.

## Tâches

- [x] Utiliser `lib/academic-structure.ts` comme source de vérité unique
- [x] Créer une représentation commune d'un groupe académique (périodes + examen + total)
- [x] Gérer deux groupes pour le secondaire (semestres)
- [x] Gérer trois groupes pour le primaire (trimestres)
- [x] Généraliser les totaux de groupe et le total annuel

## Résultat attendu

Les calculs ne sont plus limités à deux semestres.

## Vérification effectuée (13 juillet 2026)

| Critère | Résultat |
| --- | --- |
| Helpers génériques dans `academic-structure.ts` | ✅ |
| Maxima annuels par boucle sur groupes | ✅ `calculateBulletinYearMaxima(typebranch)` |
| `SEM_ORDER` / `getPlaceValue` généralisés | ✅ |
| `ClassFicheClient` sans `isSemesterComplete` codé en dur | ✅ |
| Total annuel = somme de tous les groupes actifs | ✅ secondaire (2) et primaire (3) |
| Tests automatisés | ✅ `test-bulletin-maxima.ts`, `test-bulletin-academic-groups.ts` |

## Point de départ existant

`lib/academic-structure.ts` définit déjà :

| Type | Groupes | Périodes |
| --- | --- | --- |
| SECONDAIRE | 2 | `p1`, `p2`, `exam1`, `p3`, `p4`, `exam2` |
| PRIMAIRE | 3 | `p1`…`exam3` (9 clés) |

Fonctions utiles : `getAcademicStructure`, `getAcademicGroupLabels`, `getActivePeriodKeys`.

## Limites actuelles à lever

- `lib/bulletin-maxima.ts` — `calculateBulletinYearMaxima` : 2 semestres seulement
- `lib/types/index.ts` — `SEM_ORDER`, `getPlaceValue` : 2 groupes
- `ClassFicheClient.tsx` — `isSemesterComplete`, totaux `TT1`/`TT2`

## Fichiers concernés

- `lib/academic-structure.ts`
- `lib/bulletin-maxima.ts`
- `lib/types/index.ts`
- `app/admin/.../fiches/components/ClassFicheClient.tsx`

## Critères d'acceptation

- [x] Boucle sur les groupes au lieu de conditions `sem1` / `sem2` répétées
- [x] Secondaire : 2 groupes, primaire : 3 groupes — sans duplication de listes de périodes
- [x] Total annuel = somme de tous les groupes actifs

## Prochaine étape

→ [unit-phase-04.md](./unit-phase-04.md) — Étendre les types et données du bulletin
