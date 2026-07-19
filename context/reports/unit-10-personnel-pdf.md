# Unit 10 — PDF liste personnel

## Objectif

Export PDF du module personnel, même modèle que enseignants.

## Dépendances

- Unit 00
- Unit 05 (modèle toolbar / export à cloner)

## Portée

- Module `.../personnel/`
- `export-personnel-pdf.ts` + context action + bouton toolbar

## Actions

1. Colonnes : identité, fonction, statut, contact si dispo.
2. Branding kit + filtres table.
3. Permissions alignées sur la page personnel.

## Hors scope

- Présences personnel (→ unit 13).

## Tests manuels

- Export depuis page personnel.
- Logo + nom OK.

## DoD

- PDF téléchargeable.
- `tsc` OK.
