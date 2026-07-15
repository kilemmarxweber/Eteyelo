# Calculs — Maxima et points obtenus

Formules pour chaque type de cellule du bulletin primaire v2.

## Maxima par période

```text
max(pN) = maxScore enregistré sur la fiche
          OU ponderation × 10 (secours)
```

```text
max(examN) = maxScore enregistré
             OU ponderation × 20 (secours)
```

Source actuelle : `lib/bulletin-maxima.ts` — **conserver** la logique existante.

## Maxima trimestre (MAX TRIM)

```text
max(TRIM N) = max(p_a) + max(p_b) + max(examN)
```

| Trimestre | Formule |
| --- | --- |
| 1 | `max(p1) + max(p2) + max(exam1)` |
| 2 | `max(p3) + max(p4) + max(exam2)` |
| 3 | `max(p5) + max(p6) + max(exam3)` |

Affiché dans la colonne **MAX TRIM** ; la colonne **PTS OBT** adjacente affiche les points obtenus.

## Points obtenus trimestre (PTS OBT trimestre)

```text
pts(TRIM N) = computeGroupTotal(subject, N, activePeriodKeys, "PRIMAIRE")
```

Condition d'affichage : `canShowGroupTotal(N, activePeriodKeys, "PRIMAIRE")`.

## Colonne MAX Per (trimestre 1 uniquement)

Sur la **ligne maxima** d'un cours ou domaine :

```text
cellule MAX Per = max(p1)   // barème de la 1ère période
```

Sur une **ligne de notes** : cellule vide (ou répétition du max si le modèle l'exige — par défaut **vide**).

## Colonne MAX EX

```text
cellule MAX EX = max(examN)   // barème examen
```

## Colonne PTS OBT (examen)

```text
cellule PTS OBT (examen) = note examN si période active et note ≠ 0
```

## Colonne finale : MAX | PTS OBT

### MAX (annuel)

```text
max(annuel) = max(TRIM1) + max(TRIM2) + max(TRIM3)
```

### PTS OBT (annuel)

```text
pts(annuel) = pts(TRIM1) + pts(TRIM2) + pts(TRIM3)
```

Condition : les trois trimestres doivent être complets (`canShowGroupTotal` pour 1, 2 et 3).

## Ligne MAXIMA par domaine

Pour chaque cellule de type maximum :

```text
maximaDomaine[cellule] = Σ maxima[cours du domaine][cellule]
```

Pour les cellules PTS OBT sur la ligne maxima : **toujours vide**.

## Ligne MAXIMA GÉNÉRAL

```text
maximaGeneral[cellule] = Σ maximaDomaine[cellule] pour les 5 domaines
```

Libellé colonne BRANCHES : `MAXIMA GÉNÉRAL`.

## Lignes générales (TOTAUX, POURCENTAGES, …)

| Ligne | MAX Per / MAX EX / MAX TRIM | PTS OBT |
| --- | --- | --- |
| TOTAUX | Affiche les maxima généraux | Affiche les totaux points |
| POURCENTAGES | Fond noir (pas de %) | Affiche le % sur PTS OBT trimestre |
| PLACE/NOMBRE D'ÉLÈVES | Fond noir | Classement |
| APPLICATIONS / CONDUITE | Fond noir sur exam/total | Valeur texte sur périodes |
| SIGNATURE PARENTS | Toutes cellules vides | — |

## Migration depuis l'ancien layout

| Ancienne cellule | Nouvelle répartition |
| --- | --- |
| `trim.totX` (EXAM) | `MAX EX` + `PTS OBT` (2 colonnes) |
| `trim.examX` (TOT) | `MAX TRIM` + `PTS OBT` (2 colonnes) |
| `PRIMARY_TG_COL_INDEX` (TG) | `MAX` + `PTS OBT` (colonne finale) |

## Fonctions à ajouter / adapter

```typescript
// lib/bulletin-maxima.ts ou lib/primary-bulletin-calculs.ts

function computeTrimesterMaxima(
  maxima: Record<BulletinPeriodKey, number>,
  trimesterIndex: 1 | 2 | 3,
): number;

function computeYearMaxima(
  maxima: Record<BulletinPeriodKey, number>,
): number;

function sumDomainMaxima(
  subjects: Subject[],
  cellKind: PrimaryCellKind,
): number;
```
