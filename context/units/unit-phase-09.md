# Unité — Phase 9 : Tests de sélection et d'isolation

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** [unit-phase-07.md](./unit-phase-07.md)  
**Statut :** ✅ Terminée

## Objectif

Garantir qu'aucune branche ne reçoit le mauvais format de bulletin et que les données restent isolées par organisation et branche.

## Tâches

- [x] Tester une branche primaire et une branche secondaire de la même organisation
- [x] Vérifier que chaque branche utilise le bon layout
- [x] Vérifier le filtre `organizationId + branchId` sur toutes les requêtes
- [x] Vérifier qu'un changement d'URL ne permet pas d'utiliser le type d'une autre branche
- [x] Vérifier les informations d'en-tête de chaque branche (nom, logo, adresse)

## Résultat attendu

Aucune confusion entre les branches et les formats.

## Scénarios de test

| Scénario | Attendu |
| --- | --- |
| Org A, branche primaire | Layout primaire uniquement |
| Org A, branche secondaire | Layout secondaire uniquement |
| URL avec `branchId` d'une autre branche | Refus ou données de la branche autorisée uniquement |
| `typebranch` manipulé côté client | Ignoré — type vient du serveur |

## Fichiers concernés

- `app/admin/.../fiches/page.tsx`
- `lib/auth/require-branch-context.ts`
- `lib/bulletin-context.ts`
- Tests d'intégration ou scripts dédiés

## Scripts créés / étendus

- `scripts/test-bulletin-isolation.ts` — suite dédiée phase 9 (12 tests)
- `pnpm test:bulletin-isolation` — exécute les tests d'isolation
- `pnpm test:bulletin` — inclut la suite d'isolation

## Critères d'acceptation

- [x] Isolation `organizationId` + `branchId` vérifiée
- [x] En-tête PDF correspond à la branche consultée
- [x] Pas de fuite de données entre branches

## Prochaine étape

→ [unit-phase-10.md](./unit-phase-10.md) — Contrôle visuel secondaire
