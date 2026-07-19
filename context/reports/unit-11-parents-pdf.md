# Unit 11 — PDF liste parents / tuteurs

## Objectif

Export PDF parents avec enfants liés.

## Dépendances

- Unit 00
- Unit 05 (modèle)

## Portée

- Module `.../parent/`
- `export-parents-pdf.ts` + context + toolbar

## Actions

1. Colonnes : nom parent, contacts, enfants (noms + classes).
2. Branding kit.
3. Respecter filtres / archivage.

## Hors scope

- Documents individuels type « fiche parent ».

## Tests manuels

- Parent multi-enfants → liste enfants lisible.
- Export sans crash si contact manquant.

## DoD

- PDF téléchargeable.
- `tsc` OK.
