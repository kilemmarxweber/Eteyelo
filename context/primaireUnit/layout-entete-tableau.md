# Layout — En-tête du tableau (bulletin primaire)

Structure en **3 niveaux** de hauteur (`hTop`, `hMid`, `hBottom`), alignée sur le modèle officiel RDC.

## Vue d'ensemble des 5 colonnes principales

```text
┌──────────┬─────────────────────────────────────────────────────────────────────────────┬─────────────┐
│ BRANCHES │                    1er TRIMESTRE (7 sous-col.)                              │ MAX │PTS OBT│
│          ├─────────────────────────────────────────────────────────────────────────────┤     │       │
│          │                    2e TRIMESTRE (6 sous-col.)                               │     │       │
│          ├─────────────────────────────────────────────────────────────────────────────┤     │       │
│          │                    3e TRIMESTRE (6 sous-col.)                               │     │       │
└──────────┴─────────────────────────────────────────────────────────────────────────────┴─────┴───────┘
```

## Niveau 1 (`hTop`) — Titres principaux

| Index | Libellé | Fusion verticale |
| --- | --- | --- |
| 0 | `BRANCHES` | 3 niveaux (pleine hauteur) |
| 1 | `1er TRIMESTRE` | 1 niveau |
| 2 | `2e TRIMESTRE` | 1 niveau |
| 3 | `3e TRIMESTRE` | 1 niveau |
| 4 | *(vide)* | Pas de titre parent — `MAX \| PTS OBT` directement au niveau 2 |

## Niveau 2 (`hMid`) — Sous-titres par trimestre

### 1er trimestre (7 colonnes)

```text
MAX Per | 1erP | 2eP | MAX EX | PTS OBT | MAX TRIM | PTS OBT
```

> Le **1er trimestre** est le seul à inclure la colonne `MAX Per` en tête (comme sur le modèle officiel).

### 2e et 3e trimestres (6 colonnes chacun)

```text
3eP | 4eP | MAX EX | PTS OBT | MAX TRIM | PTS OBT     (trim 2)
5eP | 6eP | MAX EX | PTS OBT | MAX TRIM | PTS OBT     (trim 3)
```

## Niveau 3 (`hBottom`) — Alignement horizontal des maxima

Sur la **ligne MAXIMA** (et uniquement pour les cellules de type maximum), le niveau 3 affiche les valeurs numériques alignées horizontalement sous chaque sous-colonne du niveau 2.

Exemple trimestre 1 (ligne MAXIMA d'un domaine) :

```text
        │ 10  │ 10  │ 10  │  20  │       │  40  │       │
        │     │     │     │      │       │      │       │
 MAX Per│     │ 1erP│ 2eP │MAX EX│PTS OBT│MAX   │PTS OBT│
        │     │     │     │      │       │TRIM  │       │
```

- `MAX Per`, `MAX EX`, `MAX TRIM`, `MAX` (colonne finale) → affichent le **barème** (maxima).
- `1erP` … `6eP`, `PTS OBT` (examen, trimestre et colonne finale) → affichent les **notes** ou restent vides sur la ligne maxima.
- Colonne finale : `MAX` et `PTS OBT` alignés comme les autres paires max/points, **sans titre parent**.

## Schéma ASCII complet de l'en-tête

```text
BRANCHES │──────────── 1er TRIMESTRE ────────────│────────── 2e TRIMESTRE ──────────│────────── 3e TRIMESTRE ──────────│ MAX │PTS OBT│
         │ MAX Per│1erP│2eP│MAX EX│PTS│MAX│PTS │3eP│4eP│MAX EX│PTS│MAX│PTS │5eP│6eP│MAX EX│PTS│MAX│PTS │ MAX │PTS OBT│
         │        │    │   │      │OBT│TRI│OBT │   │   │      │OBT│TRI│OBT │   │   │      │OBT│TRI│OBT │     │       │
```

*(PTS = PTS OBT, TRI = TRIM — abréviations visuelles uniquement)*

## Ratios proposés

Voir [`structure-colonnes.ts`](./structure-colonnes.ts) pour les constantes exactes.

Résumé :

- **5 colonnes principales** : `[0.14, 0.24, 0.22, 0.22, 0.18]` — `BRANCHES` réduite, espace aux trimestres.
- **Trimestre 1** (7 sous-col.) : `[0.10, 0.14, 0.14, 0.14, 0.14, 0.17, 0.17]`
- **Trimestres 2 et 3** (6 sous-col.) : `[0.15, 0.15, 0.15, 0.15, 0.20, 0.20]`
- **Colonne finale** (2 sous-col.) : `[0.50, 0.50]` → `MAX | PTS OBT` (sans titre parent)

## Hauteur de l'en-tête

Conserver les valeurs actuelles :

```text
rowHeightTotal = hTop + hMid + hBottom = 7 + 7 + 7 = 21 mm
```

## Extension jusqu'à MAXIMA GÉNÉRAL

L'en-tête décrit ci-dessus s'applique à **toutes** les lignes du corps du tableau, y compris :

1. Lignes de **domaine** (titre de section, pas de notes)
2. Lignes de **cours** (notes par cellule)
3. Ligne **MAXIMA** par domaine
4. Ligne **MAXIMA GÉNÉRAL** (somme de tous les domaines)
5. Lignes **générales** : TOTAUX, POURCENTAGES, PLACE/NOMBRE D'ÉLÈVES, APPLICATIONS, CONDUITE, SIGNATURE PARENTS

Chaque ligne utilise la **même grille** de colonnes ; seul le contenu et le style changent.
