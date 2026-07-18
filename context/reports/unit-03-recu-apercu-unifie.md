# Unit 03 — Reçu : aperçu unifié + impression

## Objectif

Aperçu fidèle avant impression ; unifier post-paiement et « Voir reçu » historique.

## Dépendances

- Unit 02

## Portée

- `PaymentsForm.tsx` (dialog)
- `.../frais/components/Invoice.tsx`
- `.../paiement/components/exportInvoice.tsx`
- `components/reports/ReportPreviewDialog.tsx`
- `components/reports/SchoolBrandHeader.tsx`

## Actions

1. Dialog aperçu HTML (logo, nom, lignes, totaux USD/CDF) aligné sur les données du PDF.
2. Boutons : Fermer / Imprimer (`window.print` + CSS print) / Télécharger PDF.
3. Brancher le même composant d’aperçu sur « Voir reçu » (historique).
4. Aligner devises et libellés entre preview et PDF.
5. Retirer chemins morts (`/cmj.jpg`, `MON ÉCOLE`) s’ils apparaissent encore côté reçu/invoice.

## Hors scope

- Réécriture complète `PaiementsPDF` liste (→ unit 08).

## Tests manuels

- Après paiement : aperçu ≈ PDF (montants, élève, école).
- Depuis historique : même aperçu / même branding.
- Imprimer A5 lisible (pas de coupure critique).

## DoD

- Un seul flux d’aperçu reçu pour les deux entrées UI.
- Impression navigateur OK.
- `tsc` OK.
