# Phase 03 - Archivage sans suppression

## Objectif

Remplacer la suppression physique par archivage/desactivation pour conserver les archives scolaires.

## Regle metier

Dans une ecole, les donnees doivent rester consultables : eleves, parents, classes, inscriptions, annees scolaires, cours, frais, notes, horaires, presences et paiements ne doivent pas etre supprimes depuis l'interface standard.

## Portee

- boutons et dialogs `Supprimer`
- actions `delete...`
- schemas Prisma si un champ d'archive manque
- listes et filtres actifs/archives

## Actions

1. Identifier tous les `Delete...Dialog`.
2. Remplacer les libelles visibles `Supprimer` par `Archiver`, `Desactiver`, `Cloturer`, `Annuler` ou `Masquer`.
3. Ajouter les champs necessaires si absents :
   - `isArchived Boolean @default(false)`
   - `archivedAt DateTime?`
   - `archivedById String?` si audit utilisateur utile
4. Remplacer les `prisma.*.delete` exposes par des `update`.
5. Filtrer les listes actives par defaut.
6. Ajouter un filtre ou une vue archives.
7. Garder les anciennes actions destructives seulement pour maintenance super-admin non exposee.

## Bonnes pratiques

- Preferer `status...` existant si la desactivation suffit.
- Utiliser `isArchived` quand l'objet doit disparaitre des listes actives.
- Conserver toutes les relations historiques.
- Ne pas casser les bulletins, paiements, inscriptions et presences.

## Securite

- Restreindre la consultation des archives selon role.
- Journaliser l'auteur de l'archivage si possible.
- Interdire l'archivage d'une annee scolaire courante sans procedure claire.
- Interdire l'archivage d'une classe si cela casse des inscriptions actives, ou demander cloture explicite.

## Tests manuels

- Archiver un element.
- Verifier qu'il disparait de la liste active.
- Verifier qu'il reste disponible dans les archives.
- Verifier que les historiques lies restent consultables.

## Validation avant passage

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Aucun bouton de suppression physique expose.
- Les archives sont consultables.
- Les relations historiques restent valides.
