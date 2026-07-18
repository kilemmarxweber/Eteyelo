# Unit 17 — PDF résultats / classement (P2)

## Objectif

Export classement / résultats de classe depuis le module results.

## Dépendances

- Unit 00
- Données results stables (sinon reporter)

## Portée

- `.../results/` (+ `[id]`)
- Nouveau export PDF + bouton UI

## Actions

1. Clarifier colonnes (rang, élève, moyenne, mention si existe).
2. Filtres classe / période alignés sur l’UI.
3. Branding kit.
4. Si données incompletes : documenter blocage et stopper sans demi-mesure.

## Hors scope

- Candidatures / teaching charge (hors unit ; créer unit dédiée plus tard si besoin).

## Tests manuels

- Export depuis results pour une classe avec notes.
- Classe sans résultats → message clair.

## DoD

- PDF classement utilisable **ou** unit explicitement reportée avec raison dans ce fichier.
- `tsc` OK si implémentée.

## Livré (2026-07-18)

- Colonnes PDF : **Rang | Élève | Sexe | Moyenne (%) | Points** — pas de **mention** (champ inexistant dans le module results).
- Filtres PDF = UI : classe(s), période, année.
- Branding kit Unit 00 (`getResultsReportContextAction` + `drawReportHeader` / footer).
- Bouton **Classement PDF** dans les filtres results ; toast si sélection vide / sans notes.
- Fichiers :
  - `.../results/components/export-results-classement-pdf.ts`
  - `.../results/results.action.ts`
  - branchement `FiltersCombox.tsx` / `FiltersWrapper.tsx`
