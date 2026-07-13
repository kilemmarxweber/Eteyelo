# Unité — Phase 5 : Stabiliser le bulletin secondaire

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** [unit-phase-04.md](./unit-phase-04.md)  
**Statut :** ✅ Terminée

## Objectif

Isoler le rendu secondaire dans son propre layout et améliorer la lisibilité des six cases d'évaluation, sans régression fonctionnelle.

## Tâches

- [x] Isoler le dessin secondaire dans son propre layout (`bulletin-secondary-layout.ts`)
- [x] Conserver les 4 périodes et 2 examens actuels
- [x] Rééquilibrer les six cases d'évaluation (P1, P2, EXAM 1, P3, P4, EXAM 2)
- [x] Tester les maxima à un, deux et trois chiffres
- [x] Vérifier que les lignes générales et le total général restent identiques

## Résultat attendu

Aucun changement de logique pour les branches secondaires ; tableau plus lisible.

## Colonnes attendues

```text
COURS | P1 | P2 | EXAM 1 | TOTAL 1 | P3 | P4 | EXAM 2 | TOTAL 2 | TG
```

## Calculs à préserver

```text
maximum total1 = max(P1) + max(P2) + max(EXAM 1)
maximum total2 = max(P3) + max(P4) + max(EXAM 2)
maximum général = maximum total1 + maximum total2
```

## Fichiers à créer / modifier

- `fiches/components/bulletin-secondary-layout.ts` (nouveau)
- `lib/bulletin-layout.ts` (nouveau — helpers communs de largeur)
- `useBulletinPDF.tsx` / `bulletins.tsx` (extraction du rendu secondaire)

## Largeurs actuelles à remplacer

Références audit phase 1 :

- `colRatios = [0.2, 0.22, 0.22, 0.07, 0.09, 0.02, 0.08]`
- `semSubRatios`, `semPeriodRatios`
- Coordonnées fixes `totX1`, `examX1`, `totX2`, `examX2`

→ Calcul depuis la largeur réelle de la page, pas en dur.

## Critères d'acceptation

- [x] Branche `SECONDAIRE` : rendu identique en logique, amélioré en lisibilité
- [x] Maxima à 3 chiffres lisibles dans chaque case
- [x] Aucune régression sur classement, appréciations, signatures

## Prochaine étape

→ [unit-phase-06.md](./unit-phase-06.md) — Créer le layout primaire
