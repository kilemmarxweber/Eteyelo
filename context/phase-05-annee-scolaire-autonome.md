# Phase 05 - Annee scolaire autonome

## Objectif

Creer et gerer automatiquement l'annee scolaire courante pour chaque branche.

## Regle metier

- l'annee commence en septembre ;
- elle se termine generalement le 2 juillet ;
- a un mois du debut, la prochaine annee peut etre preparee ;
- une seule annee courante par branche.

## Portee

- `SchoolYear`
- creation de branche
- modules qui utilisent l'annee courante : inscription, frais, enseignement, horaire, notes

## Actions

1. Creer un helper `getAcademicYearForDate(date)`.
2. Creer automatiquement l'annee courante dans `createBranchAction`.
3. Garantir une seule `isCurrentYear = true` par branche avec transaction.
4. Ajouter une action de preparation de la prochaine annee a partir du mois d'aout.
5. Utiliser l'annee courante par defaut dans les formulaires metier.
6. Proteger le switch annee courante avec confirmation si impact important.

## Bonnes pratiques

- Centraliser la logique de date.
- Ne pas dupliquer la generation du nom d'annee.
- Les modules ne doivent pas deviner l'annee courante chacun de leur cote.

## Securite

- Toutes les queries `SchoolYear` doivent etre filtrees par `branchId`.
- Le changement d'annee courante doit etre reserve aux roles autorises.
- Utiliser transaction pour eviter deux annees courantes.

## Tests manuels

- Creer une branche en periode scolaire.
- Verifier l'annee courante creee.
- Basculer l'annee courante.
- Verifier que les autres annees deviennent non courantes.
- Tester la preparation de la prochaine annee si date eligible.

## Validation avant passage

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Une branche a une annee courante automatiquement.
- Les modules utilisent l'annee courante sans selection inutile.
- Pas de double annee courante dans une branche.
