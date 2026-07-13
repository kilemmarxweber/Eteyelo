# Unité — Phase 13 : Validation finale

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9, §12  
**Dépend de :** toutes les phases précédentes  
**Statut :** ✅ Terminée

## Objectif

Confirmer que la fonctionnalité bulletins primaire/secondaire est complète et conforme aux règles métier.

## Critères de validation (tous requis)

- [x] Une branche **secondaire** reçoit uniquement le bulletin secondaire
- [x] Une branche **primaire** reçoit uniquement le bulletin primaire
- [x] Le secondaire affiche **4 périodes** et **2 examens**
- [x] Le primaire affiche **6 périodes** et **3 examens**
- [x] Chaque groupe de deux périodes se termine par son examen
- [x] Les maxima sont **dynamiques** (priorité au `maxScore` de la fiche)
- [x] Les **anciennes fiches** restent compatibles
- [x] Le **classement** et les **appréciations** restent corrects
- [x] Les deux formats sont **lisibles sur A4**
- [x] Aucun **choix manuel** de type de bulletin n'est nécessaire
- [x] Les données restent **isolées** par `organizationId` et `branchId`

## Règle métier de référence

> Le type de bulletin est déterminé automatiquement et uniquement par `Branch.typebranch`. Le secondaire conserve 4 périodes et 2 examens. Le primaire utilise 6 périodes et 3 examens, avec un examen après chaque groupe de deux périodes.

## Règles communes à conserver

- Priorité au `maxScore` enregistré dans la fiche
- Pondération actuelle comme secours uniquement
- Maintien de l'historique des anciens bulletins
- Calcul dynamique des maxima, classement, pourcentages
- Applications, appréciations, conduite, place, signatures
- Images officielles statiques existantes
- La création du bulletin primaire ne modifie pas les résultats du bulletin secondaire

## Livrables finaux

| Livrable | Fichier / zone |
| --- | --- |
| Contexte branche typé | `lib/bulletin-context.ts` |
| Structure académique | `lib/academic-structure.ts` |
| Layout secondaire | `bulletin-secondary-layout.ts` |
| Layout primaire | `bulletin-primary-layout.ts` |
| Routage automatique | `BulletinPDF` / `useBulletinPDF.tsx` |
| Tests | `scripts/test-bulletin-*.ts` |

## Historique des phases

| Phase | Unité | Statut |
| --- | --- | --- |
| 1 | [unit-phase-01.md](./unit-phase-01.md) | ✅ Terminée |
| 2 | [unit-phase-02.md](./unit-phase-02.md) | ✅ Terminée |
| 3 | [unit-phase-03.md](./unit-phase-03.md) | ✅ Terminée |
| 4 | [unit-phase-04.md](./unit-phase-04.md) | ✅ Terminée |
| 5 | [unit-phase-05.md](./unit-phase-05.md) | ✅ Terminée |
| 6 | [unit-phase-06.md](./unit-phase-06.md) | ✅ Terminée |
| 7 | [unit-phase-07.md](./unit-phase-07.md) | ✅ Terminée |
| 8 | [unit-phase-08.md](./unit-phase-08.md) | ✅ Terminée |
| 9 | [unit-phase-09.md](./unit-phase-09.md) | ✅ Terminée |
| 10 | [unit-phase-10.md](./unit-phase-10.md) | ✅ Terminée |
| 11 | [unit-phase-11.md](./unit-phase-11.md) | ✅ Terminée |
| 12 | [unit-phase-12.md](./unit-phase-12.md) | ✅ Terminée |
| 13 | [unit-phase-13.md](./unit-phase-13.md) | ✅ Terminée |
