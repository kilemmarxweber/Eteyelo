# Phase 06 - Classes primaire et secondaire

## Objectif

Adapter la creation et l'affichage des classes selon le type de branche.

## Regles metier

Primaire :

- pas de section ;
- pas d'option ;
- classes de `1er` a `6e` ;
- paralleles possibles : `1er A`, `1er B`, etc.

Secondaire / humanites :

- `7e`
- `8e`
- `1er {{option}}`
- `2e {{option}}`
- `3e {{option}}`
- `4e {{option}}`

## Portee

- `Classe`
- `classeSchema`
- formulaire classe
- tables classe
- menus section/option selon `typebranch`

## Actions

1. Ajouter si necessaire les champs `level`, `parallel`, `capacity`.
2. Adapter le schema et les server actions.
3. Masquer section/option pour `PRIMAIRE`.
4. Garder section/option pour `SECONDAIRE`.
5. Ajouter une generation claire du nom/code de classe.
6. Ne pas recreer les classes chaque annee.
7. Verifier que les anciennes classes restent utilisables.

## Bonnes pratiques

- Les classes appartiennent a la branche, pas a l'annee scolaire.
- L'inscription relie l'eleve, la classe et l'annee.
- Les champs optionnels doivent rester compatibles avec les donnees existantes.

## Securite

- Refuser cote serveur une option/section sur branche primaire.
- Refuser une classe secondaire invalide selon les regles retenues.
- Verifier `branchId` sur chaque action.

## Tests manuels

- Creer classe primaire sans option.
- Creer `1er A`, `1er B`, `6e A`.
- Creer classes secondaire avec option.
- Verifier que primaire ne voit pas les menus section/option apres phase UX.

## Validation avant passage

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Primaire fonctionne sans section/option.
- Secondaire conserve sections/options.
- Les classes sont reutilisables sur plusieurs annees.
