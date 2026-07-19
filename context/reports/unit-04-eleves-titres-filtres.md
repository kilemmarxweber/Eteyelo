# Unit 04 — Élèves : titres PDF selon filtres

## Objectif

Le PDF élèves reflète clairement le filtre actif (tous / classe / genre / statut).

## Dépendances

- Unit 01

## Portée

- `.../student/components/export-students-pdf.ts`
- `.../student/components/data-table-toolbar.tsx`

## Actions

1. Titre dynamique :
   - Tous → « Liste des élèves »
   - Classe → « Liste des élèves de la classe X »
   - Genre M/F → « Liste des élèves — Garçons/Filles »
   - Combinaisons sensées (classe + genre).
2. Sous-titre métadonnées : année, date génération, filtres actifs.
3. (Optionnel) bouton Aperçu liste via `ReportPreviewDialog`.

## Hors scope

- Nouveau rapport synthèse effectifs org (→ unit 06).

## Tests manuels

- Filtre F → PDF filles uniquement + titre correct.
- Filtre classe → titre + lignes cohérents.
- Sans filtre → liste globale.

## DoD

- Titre PDF = intention du filtre UI.
- `tsc` OK.
