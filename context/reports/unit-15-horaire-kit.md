# Unit 15 — Horaire : aligner sur le kit header

## Objectif

Réutiliser le kit partagé pour PDF (+ print header si pertinent) sans régression.

## Dépendances

- Unit 00

## Portée

- `.../schedule/.../export-schedule-pdf.ts`
- évent. `schedule.tsx` (header print)

## Actions

1. Remplacer helpers locaux logo/header par `lib/reports/*`.
2. Conserver `window.print()` + CSS print.
3. Vérifier nom classe / année dans le titre.

## Hors scope

- Nouveau design grille horaire.

## Tests manuels

- PDF horaire + Imprimer navigateur.
- Logo branche → org OK.

## DoD

- Plus de duplication helpers logo dans schedule export.
- `tsc` OK.
