# Phase 10 - Stabilisation finale

## Objectif

Verifier l'ensemble du parcours apres les refontes et corriger les regressions avant livraison.

## Portee

- toutes les phases precedentes ;
- parcours primaire ;
- parcours secondaire ;
- inscription ;
- archives ;
- refresh ;
- build.

## Actions

1. Rejouer tous les tests manuels par module.
2. Verifier les roles et permissions.
3. Verifier les branches primaire/secondaire.
4. Verifier les archives.
5. Verifier les historiques : bulletins, paiements, inscriptions, presences.
6. Verifier les formulaires create/update.
7. Verifier les erreurs console navigateur.
8. Verifier les routes et liens sidebar.

## Bonnes pratiques

- Corriger les regressions dans des commits/patchs separes.
- Ne pas ajouter de refactor hors sujet en stabilisation.
- Documenter les decisions metier restantes.

## Securite

- Tester qu'une branche ne voit pas les donnees d'une autre branche.
- Tester les roles non admin.
- Tester les actions archives/desactivation.
- Tester les routes directes, pas seulement les boutons.

## Validation finale

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

## Tests manuels finaux

- Page d'accueil.
- Creation branche primaire avec annee scolaire automatique.
- Creation branche secondaire avec annee scolaire automatique.
- Creation classe primaire.
- Creation classe secondaire.
- Inscription nouvel eleve.
- Inscription ancien eleve.
- Affectation classe pleine.
- Archivage et consultation archive.
- Sidebar desktop/mobile.
- Refresh apres create/update/archive/desactivation.

## Definition of Done

- Toutes les validations passent.
- Aucun warning console connu sur les parcours testes.
- Les donnees scolaires restent archivees.
- Le flux inscription est utilisable de bout en bout.
