# Unité — Phase 12 : Vérifications techniques finales

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** phases 2 à 11  
**Statut :** ✅ Terminée

## Objectif

Confirmer que le projet compile, passe le lint et les tests, et ne contient pas de duplication dangereuse.

## Tâches

- [x] Exécuter TypeScript (`tsc` / build type-check)
- [x] Exécuter le lint
- [x] Exécuter les tests des maxima (`scripts/test-bulletin-maxima.ts`)
- [x] Exécuter les tests des layouts et du type de branche
- [x] Exécuter le build de production
- [x] Vérifier les imports et supprimer les anciens fichiers devenus inutiles

## Résultat attendu

Aucune erreur technique ou duplication dangereuse.

## Commandes typiques

```bash
pnpm lint
pnpm build
# scripts de test du projet selon package.json
```

## Points de vigilance

- `useBulletinPDF.tsx` et `bulletins.tsx` : éviter deux implémentations divergentes du primaire
- Imports morts après extraction des layouts
- Types Prisma régénérés si schéma touché

## Critères d'acceptation

- [x] Build production réussi
- [x] Zéro erreur TypeScript sur les fichiers modifiés
- [x] Tous les scripts de test bulletin au vert

## Prochaine étape

→ [unit-phase-13.md](./unit-phase-13.md) — Validation finale
