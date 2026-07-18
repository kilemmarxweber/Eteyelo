# Plan — Rapports imprimables & export PDF

## Objectif

Harmoniser **aperçu + export PDF** des rapports scolaires (branding dynamique, logo établissement, impression).

## Règle de travail

- Exécuter **une seule unit** à la fois.
- Ne pas démarrer l’unit suivante tant que la DoD de la courante n’est pas verte.
- Chaque unit a son fichier dédié dans ce dossier.
- **Ne pas toucher aux bulletins** dans le cadre des units (pas d’unit 14 bulletin, pas de patch `useBulletinPDF`).

## Ordre d’exécution

| Unit | Fichier | Priorité | Dépend de |
|---|---|---|---|
| 00 | [unit-00-kit-branding.md](./unit-00-kit-branding.md) | P0 | — |
| 01 | [unit-01-migrate-students-export.md](./unit-01-migrate-students-export.md) | P0 | 00 |
| 02 | [unit-02-recu-branding-logo.md](./unit-02-recu-branding-logo.md) | P0 | 00 |
| 03 | [unit-03-recu-apercu-unifie.md](./unit-03-recu-apercu-unifie.md) | P0 | 02 |
| 04 | [unit-04-eleves-titres-filtres.md](./unit-04-eleves-titres-filtres.md) | P0 | 01 |
| 05 | [unit-05-enseignants-pdf.md](./unit-05-enseignants-pdf.md) | P0 | 00 |
| 06 | [unit-06-effectifs-rapport-pdf.md](./unit-06-effectifs-rapport-pdf.md) | P0 | 00 |
| 07 | [unit-07-caisse-logo-branche.md](./unit-07-caisse-logo-branche.md) | P1 | 00 |
| 08 | [unit-08-liste-paiements-jspdf.md](./unit-08-liste-paiements-jspdf.md) | P1 | 00, 03 |
| 09 | [unit-09-impayes-pdf.md](./unit-09-impayes-pdf.md) | P1 | 00 |
| 10 | [unit-10-personnel-pdf.md](./unit-10-personnel-pdf.md) | P1 | 00, 05 |
| 11 | [unit-11-parents-pdf.md](./unit-11-parents-pdf.md) | P1 | 00, 05 |
| 12 | [unit-12-presences-eleves-pdf.md](./unit-12-presences-eleves-pdf.md) | P1 | 00 |
| 13 | [unit-13-presences-staff-pdf.md](./unit-13-presences-staff-pdf.md) | P1 | 00, 12 |
| ~~14~~ | ~~unit-14-bulletins-logo~~ | — | **Exclue — ne pas toucher aux bulletins** |
| 15 | [unit-15-horaire-kit.md](./unit-15-horaire-kit.md) | P2 | 00 |
| 16 | [unit-16-fiche-notes-header.md](./unit-16-fiche-notes-header.md) | P2 | 00 |
| 17 | [unit-17-resultats-classement-pdf.md](./unit-17-resultats-classement-pdf.md) | P2 | 00 |
| 18 | [unit-18-qa-multi-branche.md](./unit-18-qa-multi-branche.md) | P0 | 01–07 min. |

## Contexte & principes

Voir [principes.md](./principes.md) (audit, stack, sécurité, hors scope).

## Validation commune (chaque unit)

```bash
npx tsc --noEmit
npm run lint
```

Build complet recommandé avant de clôturer un lot P0 (`00` → `06` + `18`).
