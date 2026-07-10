# Phase 07 - Capacite et affectation automatique

## Objectif

Affecter automatiquement un eleve dans une classe libre selon niveau, option et capacite.

## Regle metier

Si `1er A` est plein, l'eleve doit etre affecte a `1er B`. Si `B` est plein, passer a `C`, etc. Si aucune classe libre n'existe, proposer de creer la prochaine parallele ou bloquer avec message clair.

## Portee

- `ClassEnrollment`
- `Classe.capacity`
- actions inscription
- helpers d'affectation

## Actions

1. Creer un helper serveur `findAvailableClassForLevel`.
2. Compter les inscriptions actives par classe et annee scolaire.
3. Trier les paralleles `A`, `B`, `C`.
4. Affecter la premiere classe disponible.
5. Utiliser une transaction Prisma pour creer l'inscription.
6. Gérer le cas aucune classe libre.
7. Ajouter des messages utilisateur clairs.

## Bonnes pratiques

- L'affectation doit etre cote serveur, jamais seulement cote client.
- Ne pas se fier a un compteur stocke sans verification.
- Garder `@@unique([schoolYearId, studentId])` comme protection double inscription.

## Securite

- Filtrer toutes les classes par `branchId`.
- Verifier que l'eleve appartient a la branche.
- Verifier que l'annee scolaire appartient a la branche.
- Eviter les courses concurrentes avec transaction.

## Tests manuels

- Capacite `1er A = 1`.
- Inscrire premier eleve : `1er A`.
- Inscrire deuxieme eleve : `1er B`.
- Tenter inscription si aucune classe libre.
- Verifier qu'un eleve ne peut pas etre inscrit deux fois la meme annee.

## Validation avant passage

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Affectation automatique fiable.
- Classe pleine respectee.
- Transactions et contraintes protegees.
