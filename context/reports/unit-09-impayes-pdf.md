# Unit 09 — Rapport impayés / situation financière

## Objectif

Nouveau PDF : élèves à jour / partiel / en retard avec montants dus.

## Dépendances

- Unit 00

## Portée

- Module paiement / frais
- Nouvelle action `getUnpaidReportContext` + `export-unpaid-pdf.ts`
- Entrée UI (toolbar paiements ou section caisse)

## Actions

1. Définir règles métier « à jour / partiel / retard » (réutiliser logique existante si dispo).
2. Filtres : classe, période / année.
3. PDF brandé : élève, classe, dû, payé, reste, statut.
4. Garde-fous serveur branche/org.

## Hors scope

- Relances email automatiques.
- Comptabilité avancée.

## Tests manuels

- Classe avec impayés → lignes cohérentes.
- Aucun impayé → PDF vide ou message clair, pas de crash.

## DoD

- Export accessible depuis l’UI finance.
- Header kit.
- `tsc` OK.
