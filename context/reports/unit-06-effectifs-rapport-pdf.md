# Unit 06 — PDF synthèse effectifs (`/rapport`)

## Objectif

Remplacer/améliorer l’export PDF du dashboard org : totaux élèves, genre, classes, enseignants — brandé.

## Dépendances

- Unit 00

## Portée

- `.../rapport/rapport-dashboard.tsx`
- Export PDF actuel du dashboard
- évent. `rapport.action.ts`

## Actions

1. Brancher header/footer kit (logo org ou branche sélectionnée selon UI).
2. Sections : totaux élèves (actifs), garçons/filles, par classe, count enseignants/parents.
3. Conserver Excel si déjà utile ; PDF lisible sans charts obligatoires.
4. Titre + période / année claire.

## Hors scope

- Refonte visuelle Recharts du dashboard.
- Export listes nominatives (déjà units 04/05).

## Tests manuels

- Depuis `/rapport` : PDF avec totaux genre + enseignants.
- Sans logo : pas de crash.

## DoD

- PDF brandé, tables lisibles.
- Plus de PDF « tables nues » sans en-tête école.
- `tsc` OK.
