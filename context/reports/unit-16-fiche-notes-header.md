# Unit 16 — Fiche de notes : header brandé

## Objectif

Améliorer l’export PDF fiche notes avec en-tête établissement.

## Dépendances

- Unit 00

## Portée

- `.../fiches/[id]/FicheExportActions.tsx` (et helpers liés)

## Actions

1. Ajouter header kit (logo, nom, titre fiche, classe, période).
2. Conserver Excel tel quel sauf si header texte utile.
3. Pagination footer.

## Hors scope

- Bulletins complets (→ unit 14).

## Tests manuels

- Export PDF fiche : header école visible.
- Tableau notes intact.

## DoD

- PDF fiche brandé.
- `tsc` OK.
