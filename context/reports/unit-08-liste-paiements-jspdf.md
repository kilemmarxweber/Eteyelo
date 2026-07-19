# Unit 08 — Liste paiements en jsPDF brandé

## Objectif

Remplacer `PaiementsPDF` (@react-pdf + placeholders) par un export jsPDF cohérent.

## Dépendances

- Unit 00
- Unit 03 (recommandé : branding reçu déjà stable)

## Portée

- `.../paiement/components/PaiementsPDF.tsx`
- `PaiementsTable.tsx` (bouton download)
- suppression refs `MON ÉCOLE`, `/cmj.jpg`, taux hardcodé

## Actions

1. Réécrire l’export en jsPDF + autotable + kit header.
2. Colonnes : date, élève, mode, montant(s), référence.
3. Respecter filtres / période de la table.
4. Retirer dépendance d’usage `@react-pdf` pour ce flux si plus utilisée ailleurs (vérifier avant suppression package).

## Hors scope

- Reçu unitaire (units 02–03).
- Impayés (→ unit 09).

## Tests manuels

- Download depuis table paiements.
- Branding école correct.
- Plus d’image 404 `/cmj.jpg`.

## DoD

- Un seul stack jsPDF pour la liste.
- `tsc` OK.
