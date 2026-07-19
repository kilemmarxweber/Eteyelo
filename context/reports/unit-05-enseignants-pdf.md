# Unit 05 — PDF liste enseignants

## Objectif

Export PDF enseignants depuis la toolbar, brandé comme les élèves.

## Dépendances

- Unit 00

## Portée

- Module `.../teacher/`
- Nouveau : `export-teachers-pdf.ts`
- Nouveau : `getTeacherReportContextAction` (ou réutiliser branding partagé)
- Toolbar teacher

## Actions

1. Action serveur context (branding + année) avec garde-fous branche/org.
2. Générateur jsPDF : nom, contact si dispo, classes/matières, statut.
3. Bouton « Rapport PDF » dans la toolbar.
4. Respecter filtres table si présents.

## Hors scope

- Présences enseignants (→ unit 13).
- Charge horaire teaching (P2 / unit 17 voisin).

## Tests manuels

- Export depuis page teacher.
- Logo + nom école présents.
- Rôle non autorisé → refus serveur.

## DoD

- PDF téléchargeable.
- Header kit partagé.
- `tsc` OK.
