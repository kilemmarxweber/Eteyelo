# Glossaire — Bulletin primaire RDC

Terminologie officielle utilisée dans l'en-tête du tableau et dans le code.

## Abréviations en-tête

| Libellé affiché | Signification complète | Rôle |
| --- | --- | --- |
| **MAX Per** | Maxima de période | Maximum théorique **avant** la 1ère période du trimestre (uniquement trimestre 1) ; rappel du barème période |
| **1erP / 2eP** … **6eP** | 1ère à 6ème période | Notes obtenues par l'élève sur chaque période |
| **MAX EX** | Maxima examen | Maximum théorique de l'examen de fin de trimestre |
| **PTS OBT** | Points obtenus | Points effectivement obtenus (note ou total selon la colonne) |
| **MAX TRIM** | Maxima trimestre | Somme des maxima : `max(P1) + max(P2) + max(EXAM)` du trimestre |
| **MAX** | Maxima annuel | Colonne finale — `max(TRIM1) + max(TRIM2) + max(TRIM3)` |
| **PTS OBT** | Points obtenus | Selon la colonne : note, total trimestre ou total annuel |

## Correspondance clés techniques

| Libellé bulletin | Clé stockage | Clé maxima |
| --- | --- | --- |
| 1erP | `p1` | `maxima.p1` |
| 2eP | `p2` | `maxima.p2` |
| MAX EX (trim 1) | — | `maxima.exam1` |
| PTS OBT exam (trim 1) | `exam1` | — |
| MAX TRIM (trim 1) | — | `maxima.tt1` (calculé) |
| PTS OBT trim (trim 1) | — | `computeGroupTotal(subject, 1)` |
| 3eP | `p3` | `maxima.p3` |
| 4eP | `p4` | `maxima.p4` |
| MAX EX (trim 2) | — | `maxima.exam2` |
| … | … | … |
| 5eP | `p5` | `maxima.p5` |
| 6eP | `p6` | `maxima.p6` |
| MAX EX (trim 3) | — | `maxima.exam3` |
| MAX (colonne finale) | — | `maxima.tg` (année) |
| PTS OBT (colonne finale) | — | somme `tt1 + tt2 + tt3` |

## Anciens libellés (à remplacer)

| Ancien | Nouveau |
| --- | --- |
| `COURS` | `BRANCHES` |
| `TR JOURN` | *(supprimé — colonnes plates)* |
| `EXAM` | `MAX EX` + `PTS OBT` (deux colonnes) |
| `TOT` | `MAX TRIM` + `PTS OBT` (deux colonnes) |
| `TG` / `TOTAL` | `MAX \| PTS OBT` (sans titre parent) |
