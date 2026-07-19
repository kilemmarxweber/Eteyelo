# Unit 00 — Kit branding partagé

## Objectif

Créer une base unique pour brandir PDF et aperçus (logo, nom, header/footer).

## Dépendances

Aucune.

## Portée

- `lib/reports/resolve-school-branding.ts`
- `lib/reports/image-to-data-url.ts`
- `lib/reports/pdf-header-footer.ts`
- `lib/reports/types.ts` (`SchoolReportContext`)
- `components/reports/SchoolBrandHeader.tsx` (HTML aperçu)
- `components/reports/ReportPreviewDialog.tsx` (shell dialog)

## Actions

1. Définir `SchoolReportContext` :

```ts
type SchoolReportContext = {
  organizationId: string;
  branchId: string;
  schoolName: string;
  address?: string;
  phone?: string;
  logoUrl: string;
  academicYearLabel?: string;
  generatedAt: string;
  exchangeRateUsdCdf?: number;
};
```

2. Implémenter résolution logo/nom/adresse (réutiliser `resolveBulletinLogoUrl` / students / schedule).
3. Extraire `imageUrlToDataUrl` (copie depuis export students).
4. Implémenter `drawReportHeader` / `drawReportFooter` jsPDF.
5. Créer composants HTML header + dialog aperçu (sans brancher un métier encore).

## Hors scope

- Migrer un export existant (→ unit 01).
- Toucher au reçu (→ unit 02).

## Tests manuels

- Import des modules sans erreur runtime.
- `drawReportHeader` appelé dans un script/smoke minimal si utile.

## DoD

- Fichiers `lib/reports/*` et composants shell présents.
- Types exportés utilisables.
- `npx tsc --noEmit` OK.
