# Unit 13 — PDF présences enseignants / personnel

## Objectif

Export présences staff (teacher-attendance + personnel-attendance).

## Dépendances

- Unit 00
- Unit 12 (réutiliser pattern période / synthèses)

## Portée

- `.../attendance/teacher-attendance/`
- `.../attendance/personnel-attendance/`
- Exports PDF + boutons UI

## Actions

1. Synthèse période (présent / absent / retard si statuts existent).
2. Variante feuille journalière si l’UI jour existe déjà.
3. Branding kit ; permissions alignées.

## Hors scope

- Liste nominative RH hors présence (units 05/10).

## Tests manuels

- Export teacher-attendance.
- Export personnel-attendance.
- Période vide → OK.

## DoD

- Au moins un export par module staff attendance.
- `tsc` OK.
