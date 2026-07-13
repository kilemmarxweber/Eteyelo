# Unité — Phase 10 : Contrôle visuel secondaire

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** [unit-phase-05.md](./unit-phase-05.md), [unit-phase-07.md](./unit-phase-07.md)  
**Statut :** ✅ Terminée

## Objectif

Valider manuellement le rendu PDF du bulletin secondaire après refonte des largeurs de colonnes.

## Tâches

- [x] Générer un bulletin secondaire individuel
- [x] Générer un export de classe (plusieurs élèves)
- [x] Vérifier les six cases d'évaluation (P1, P2, EXAM 1, P3, P4, EXAM 2)
- [x] Vérifier les maxima à un, deux et trois chiffres
- [x] Vérifier la dernière ligne et le bas de page (signatures, totaux généraux)

## Résultat attendu

Bulletin secondaire lisible et sans régression.

## Checklist visuelle

| Zone | Vérification |
| --- | --- |
| En-tête | Logo, nom école, branche, année |
| Tableau matières | 6 colonnes d'évaluation équilibrées |
| Totaux semestre | TOTAL 1, TOTAL 2 corrects |
| TG | Total général visible |
| Colonnes latérales | Place, %, application, conduite |
| Bas de page | Signatures parents, pas de coupure |

## Critères d'acceptation

- [x] Comparaison avec un bulletin existant avant refonte : logique identique
- [x] Aucun débordement horizontal A4
- [x] Export classe : toutes les pages cohérentes

## Vérification exécutée

1. Script `scripts/test-bulletin-visual-secondary.ts` : 9 contrôles automatisés
2. PDF échantillons générés dans `context/samples/phase-10/` :
   - `bulletin-secondaire-individuel.pdf` (maxima à 3 chiffres)
   - `bulletin-secondaire-classe.pdf` (3 élèves, maxima à 2 chiffres)
3. Commande : `pnpm test:bulletin-visual-secondary`

## Prochaine étape

→ [unit-phase-11.md](./unit-phase-11.md) — Contrôle visuel primaire
