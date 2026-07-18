# Rapports — Principes transverses

Référence pour toutes les units. Ne pas réimplémenter au cas par cas.

## Design

1. En-tête : logo + nom établissement + adresse.
2. Logo : `Branch.image.logo` → `Organization.logo` → pas d’image si absent.
3. Aperçu obligatoire pour documents individuels (reçu) ; optionnel pour listes.
4. Stack : **jsPDF + autotable** (pas de nouveau `@react-pdf`).
5. Pas de constantes magiques établissement / taux FX dans le PDF.
6. Filtres UI = contenu du PDF.

## Pattern

```
getXxxReportContext(branchId)
  → SchoolReportContext
Client
  → imageUrlToDataUrl(logoUrl)
  → drawReportHeader / corps / drawReportFooter
```

## Sécurité

- Vérifier `organizationId` / `branchId` / rôles sur chaque action context.
- Pas de données hors branche.
- Respecter filtres statut (actifs vs archivés).

## Hors scope global

- Refonte charts du dashboard `/rapport`.
- PDF générés côté serveur (queue).
- **Bulletins** (aucune unit dédiée ; ne pas modifier layout / PDF / assets RDC–armoiries dans le cadre des units).
- Remplacement assets ministériels bulletins (RDC / armoiries).
- Solde d’ouverture caisse.

## Audit initial (état de départ)

| Rapport | Logo dynamique | Problème |
|---|---|---|
| Liste élèves | Oui | Référence |
| Reçu | Non peuplé | Hardcodé Marguerite |
| PaiementsPDF | Non | Placeholder `/cmj.jpg` |
| Caisse | Org seul | Pas logo branche |
| Bulletins | — | Hors units (ne pas toucher) |
| Enseignants / personnel / parents / présences | — | Pas d’export |

## Références code

| Sujet | Chemin |
|---|---|
| Reçu PDF | `components/FacturePaymentStudent.tsx` |
| Payload reçu | `.../paiement/paiement.action.ts` |
| Export élèves | `.../student/components/export-students-pdf.ts` |
| Logo bulletin | `lib/bulletin-context.ts` *(hors units)* |
| Dashboard | `.../rapport/rapport-dashboard.tsx` |
| Caisse | `.../paiement/components/export-cashier-pdf.ts` |
| Liste paiements | `.../paiement/components/PaiementsPDF.tsx` |
| Horaire | `.../schedule/.../export-schedule-pdf.ts` |
| Bulletins | `.../fiches/components/useBulletinPDF.tsx` *(hors units)* |
