# Unit 12 — PDF présences élèves

## Objectif

Export synthèse / détail présences élèves sur une période (souvent oublié, déjà évoqué en settings).

## Dépendances

- Unit 00

## Portée

- Module `.../attendance/`
- Nouvelle action + `export-student-attendance-pdf.ts`
- Entrée UI (session ou page attendance)

## Actions

1. Filtres : période, classe (obligatoire ou optionnelle selon UX existante).
2. Synthèse : présents / absents / retards / excusés.
3. Option détail par élève si données dispo.
4. Branding kit ; vide = message clair.

## Hors scope

- Présences enseignants/personnel (→ unit 13).
- Paramétrage settings attendance (hors export).

## Tests manuels

- Période avec données → totaux cohérents avec UI.
- Période vide → pas de crash.

## DoD

- Au moins un export présence élèves depuis l’UI.
- `tsc` OK.
