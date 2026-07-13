# Unité — Phase 2 : Ajouter le type de branche au contexte du bulletin

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Dépend de :** [unit-phase-01.md](./unit-phase-01.md) ✅  
**Statut :** ✅ Terminée (13 juillet 2026)

## Objectif

Transmettre le type vérifié de la branche (`PRIMAIRE` | `SECONDAIRE`) jusqu'au client et au générateur PDF, sans choix manuel.

## Tâches

- [x] Sélectionner `typebranch` dans la requête sécurisée de la branche (`fiches/page.tsx` ou équivalent)
- [x] Ajouter `branchType: "PRIMAIRE" | "SECONDAIRE"` dans `BulletinBranchContext` (`lib/bulletin-context.ts`)
- [x] Transmettre ce champ à `ClassFicheClient` et au générateur PDF (`useBulletinPDF.tsx`)
- [x] Ajouter des tests pour `PRIMAIRE` et `SECONDAIRE` (`scripts/test-bulletin-context.ts`)

## Résultat attendu

Le client connaît le type vérifié de la branche, issu de `organizationId` + `branchId`, jamais du navigateur.

## État actuel du code

```ts
// lib/bulletin-context.ts — branchType absent
export type BulletinBranchContext = {
  organizationName: string;
  branchName: string;
  branchCode: string;
  address: string;
  city: string;
  country: string;
  logoUrl: string;
  // branchType manquant
};
```

`requireBranchContext()` expose déjà `typebranch` côté serveur (`lib/auth/require-branch-context.ts`).

## Fichiers concernés

- `app/admin/.../fiches/page.tsx`
- `lib/bulletin-context.ts`
- `app/admin/.../fiches/components/ClassFicheClient.tsx`
- `app/admin/.../fiches/components/useBulletinPDF.tsx`
- `scripts/test-bulletin-context.ts`

## Critères d'acceptation

- [x] `buildBulletinBranchContext` inclut `branchType` normalisé
- [x] Aucune valeur libre acceptée depuis le client
- [x] Tests verts pour les deux types de branche

## Prochaine étape

→ [unit-phase-03.md](./unit-phase-03.md) — Généraliser les groupes académiques
