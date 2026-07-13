# Unité — Phase 11 : Contrôle visuel primaire

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9, §5  
**Dépend de :** [unit-phase-06.md](./unit-phase-06.md), [unit-phase-07.md](./unit-phase-07.md)  
**Statut :** ✅ Terminée

## Objectif

Valider manuellement le rendu PDF du bulletin primaire sur A4 portrait avec 3 trimestres complets.

## Tâches

- [x] Générer un bulletin primaire individuel
- [x] Générer un export de classe
- [x] Vérifier les neuf cases d'évaluation (6 périodes + 3 examens)
- [x] Vérifier les trois totaux trimestriels (TOTAL 1, TOTAL 2, TOTAL 3)
- [x] Vérifier le total général (TG)
- [x] Vérifier la dernière ligne et le bas de page
- [x] Vérifier qu'aucun texte ou nombre ne se chevauche

## Résultat attendu

Bulletin primaire lisible sur une page A4.

## Checklist visuelle

| Zone | Vérification |
| --- | --- |
| Trimestre 1 | P1, P2, EXAM 1, TOTAL 1 |
| Trimestre 2 | P3, P4, EXAM 2, TOTAL 2 |
| Trimestre 3 | P5, P6, EXAM 3, TOTAL 3 |
| TG | Somme des 3 totaux trimestriels |
| Colonnes latérales | Place, %, application, conduite pour 3 groupes |
| Lisibilité | Police réduite si nécessaire, pas de chevauchement |

## Décision paysage

N'envisager le format paysage que si le primaire reste illisible en portrait malgré la réduction des colonnes (cf. §11 du document parent).

## Critères d'acceptation

- [x] 9 cases d'évaluation lisibles
- [x] Page entière visible sans scroll horizontal
- [x] Identité visuelle alignée sur le secondaire

## Vérification exécutée

1. Script `scripts/test-bulletin-visual-primary.ts` : 12 contrôles automatisés
2. PDF échantillons générés dans `context/samples/phase-11/` :
   - `bulletin-primaire-individuel.pdf` (maxima à 3 chiffres)
   - `bulletin-primaire-classe.pdf` (3 élèves, maxima à 2 chiffres)
3. Commande : `pnpm test:bulletin-visual-primary`

## Prochaine étape

→ [unit-phase-12.md](./unit-phase-12.md) — Vérifications techniques finales
