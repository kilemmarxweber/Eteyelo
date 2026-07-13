# Unité — Phase 7 : Sélection automatique du layout

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §6, §9  
**Dépend de :** [unit-phase-02.md](./unit-phase-02.md), [unit-phase-05.md](./unit-phase-05.md), [unit-phase-06.md](./unit-phase-06.md)  
**Statut :** ✅ Terminée

## Objectif

Router automatiquement vers le bon moteur de dessin selon `branchType`, sans sélecteur manuel.

## Tâches

- [x] Créer un composant ou une fonction de routage interne dans `BulletinPDF`
- [x] Utiliser le layout primaire lorsque `branchType = PRIMAIRE`
- [x] Utiliser le layout secondaire lorsque `branchType = SECONDAIRE`
- [x] Ne pas afficher de sélecteur manuel de type de bulletin
- [x] Refuser silencieusement toute valeur non gérée — fallback secondaire selon la normalisation existante

## Résultat attendu

Une branche ne voit que son propre type de bulletin.

## Architecture cible

```text
BulletinPDF
├── sélection automatique selon branchType
├── données et calculs communs
├── rendu secondaire  → bulletin-secondary-layout.ts
└── rendu primaire    → bulletin-primary-layout.ts
```

## Règle de sélection

```text
typebranch = SECONDAIRE → bulletin secondaire uniquement
typebranch = PRIMAIRE   → bulletin primaire uniquement
```

Le type doit venir de la branche vérifiée avec `organizationId` et `branchId`. Il ne doit pas être déduit du nombre de périodes ni d'une valeur fournie librement par le navigateur.

## Fichiers concernés

- `fiches/components/BulletinPDF.tsx` (ou point d'entrée équivalent)
- `useBulletinPDF.tsx`
- `lib/bulletin-context.ts`

## Critères d'acceptation

- [x] Un seul bouton de génération de bulletin
- [x] Aucune option UI pour choisir le format
- [x] Valeur inconnue → normalisation + fallback sécurisé

## Prochaine étape

→ [unit-phase-08.md](./unit-phase-08.md) — Tests fonctionnels des calculs
