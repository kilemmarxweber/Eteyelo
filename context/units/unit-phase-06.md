# Unité — Phase 6 : Créer le layout primaire

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9, §5  
**Dépend de :** [unit-phase-05.md](./unit-phase-05.md)  
**Statut :** ✅ Terminée

## Objectif

Produire un bulletin primaire complet (6 périodes, 3 examens, 3 totaux trimestriels) lisible sur A4 portrait.

## Tâches

- [x] Reprendre l'identité visuelle du bulletin secondaire
- [x] Créer trois groupes de colonnes pour les trimestres
- [x] Ajouter `P5`, `P6`, `EXAM 3` et `TOTAL 3`
- [x] Recalculer toutes les positions depuis la largeur disponible
- [x] Conserver les colonnes générales essentielles (place, %, application, conduite, etc.)
- [x] Empêcher le dépassement horizontal de la page A4

## Résultat attendu

Bulletin primaire complet avec 6 périodes et 3 examens.

## Colonnes attendues

```text
COURS
| P1 | P2 | EXAM 1 | TOTAL 1
| P3 | P4 | EXAM 2 | TOTAL 2
| P5 | P6 | EXAM 3 | TOTAL 3
| TG
```

## Proportions recommandées

| Colonne | Largeur |
| --- | --- |
| COURS | principale |
| PÉRIODE | petite |
| EXAMEN | moyenne |
| TOTAL TRIMESTRE | moyenne |
| TG | moyenne |
| AUTRES | minimale lisible |

Réduction de police uniquement si le contenu dépasse. Mêmes hauteurs de lignes que le secondaire lorsque possible.

## Calculs

```text
total1 = P1 + P2 + EXAM 1
total2 = P3 + P4 + EXAM 2
total3 = P5 + P6 + EXAM 3
total général = total1 + total2 + total3
pourcentage = points obtenus / maximum réel × 100
```

## Fichiers à créer

- `fiches/components/bulletin-primary-layout.ts`
- `lib/bulletin-layout.ts` (partagé avec le secondaire)

## Critères d'acceptation

- [x] 9 cases d'évaluation visibles (6 périodes + 3 examens)
- [x] 3 totaux trimestriels + TG
- [x] Dernière ligne et bas de page visibles verticalement
- [x] Aucun chevauchement texte/nombre

## Prochaine étape

→ [unit-phase-07.md](./unit-phase-07.md) — Sélection automatique du layout
