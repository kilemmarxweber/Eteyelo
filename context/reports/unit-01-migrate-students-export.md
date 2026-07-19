# Unit 01 — Migrer export élèves vers le kit

## Objectif

Prouver le kit en basculant l’export élèves existant sans régression majeure.

## Dépendances

- Unit 00

## Portée

- `.../student/components/export-students-pdf.ts`
- évent. `getStudentReportContextAction` si besoin d’aligner le type

## Actions

1. Remplacer helpers locaux (logo, header) par `lib/reports/*`.
2. Conserver colonnes, orientation, filtres actuels.
3. Vérifier fallback logo branche → org.

## Hors scope

- Titres dynamiques par genre/classe (→ unit 04).
- Aperçu liste élèves.

## Tests manuels

- Export PDF depuis toolbar students (tous / une classe).
- Branche avec logo : logo visible.
- Branche sans logo : PDF OK sans crash.

## DoD

- Plus de duplication `imageUrlToDataUrl` dans ce fichier.
- Visuel équivalent ou meilleur.
- `tsc` OK.
