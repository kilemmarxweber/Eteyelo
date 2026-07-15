# Bulletin primaire — unité de spécification (`primaireUnit`)

Ce dossier centralise **toute la logique et le plan d'exécution** pour le bulletin scolaire primaire conforme au modèle officiel RDC (Ministère de l'Éducation Nationale).

## Référence visuelle

Modèle cible : bulletin « DEGRE MOYEN (3ème, 4è ANNÉE) » — en-tête tableau avec colonnes `MAX Per`, périodes, `MAX EX`, `PTS OBT`, `MAX TRIM`, `PTS OBT`, et colonne finale `MAX | PTS OBT`.

## Fichiers du dossier

| Fichier | Rôle |
| --- | --- |
| [`plan-execution.md`](./plan-execution.md) | **Ordre d'exécution** des phases (1 → 8) |
| [`layout-entete-tableau.md`](./layout-entete-tableau.md) | Géométrie et libellés de l'en-tête (3 niveaux) |
| [`structure-colonnes.ts`](./structure-colonnes.ts) | Constantes, ratios, clés de périodes — source de vérité |
| [`domaines-cours.md`](./domaines-cours.md) | Les 5 domaines et regroupement des cours |
| [`glossaire.md`](./glossaire.md) | Définitions : Max Per, Max EX, Max TRIM, PTS OBT, MAX |
| [`calculs-maxima.md`](./calculs-maxima.md) | Formules maxima par cellule et ligne MAXIMA |
| [`rendu-lignes.md`](./rendu-lignes.md) | Règles de rendu : cours, domaines, maxima, généraux |

## Écart actuel vs cible

| Aspect | Actuel (`bulletin-primary-layout.ts`) | Cible (`primaireUnit`) |
| --- | --- | --- |
| Colonne 1 | `COURS` | `BRANCHES` |
| Sous-structure trimestre | `TR JOURN \| EXAM \| TOT` | Colonnes plates : `MAX Per \| 1erP \| 2eP \| MAX EX \| PTS OBT \| MAX TRIM \| PTS OBT` |
| Colonne finale | `TG` (1 cellule) | `MAX \| PTS OBT` (sans titre parent) |

## Fichiers code à modifier (exécution)

```
app/.../fiches/components/
  bulletin-primary-layout.ts    ← géométrie + en-tête
  bulletin-primary-render.ts    ← rendu lignes cours / généraux
  useBulletinPDF.tsx            ← pipeline blocs par domaine

lib/
  bulletin-maxima.ts            ← calculs max trimestre / année
  types/index.ts                ← helpers draw si besoin

scripts/
  test-bulletin-layouts.ts
  test-bulletin-visual-primary.ts
```

## Point d'entrée

Commencer par [`plan-execution.md`](./plan-execution.md) — phase 1.
