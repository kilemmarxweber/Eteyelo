# Phase 01 - Resultats

Date d'execution : 2026-07-10

## Statut

Phase executee.

Fichier source execute : `context/phase-01-page-principale.md`

## Changements realises

- Extraction de la logique serveur de la page publique principale vers `lib/home/home-data.ts`.
- Extraction des types de donnees home :
  - `HomeSchool`
  - `HomeEvent`
  - `HomePartner`
  - `NewSchool`
  - `ResultSlide`
  - `HomeData`
- Extraction des donnees fallback :
  - ecoles fallback ;
  - evenements fallback ;
  - partenaires fallback ;
  - galerie fallback ;
  - nouvelles ecoles fallback ;
  - statistiques fallback.
- Ajout d'un fallback global si les requetes Prisma de la page d'accueil echouent.
- Reduction de `app/page.tsx` : la page orchestre maintenant les donnees via `getHomeData()`.
- Retrait de l'import Prisma de `app/page.tsx`.
- Ajout d'une strategie ISR :

```ts
export const revalidate = 300;
```

## Fichiers modifies

- `app/page.tsx`
- `lib/home/home-data.ts`

## Securite et donnees publiques

- Les requetes Prisma restent cote serveur.
- Les `select` Prisma sont limites aux champs utiles a la page publique.
- Les branches restent filtrees par `isActive: true`.
- Les partenaires restent filtres par `isActive: true`.
- Les evenements/resultats restent lies a des branches actives.

## Validations executees

```bash
npx tsc --noEmit  # OK
npm run lint      # OK
npm run build     # OK apres relance hors sandbox
```

Note build :

- premiere execution sandbox : echec `spawn EPERM`.
- relance hors sandbox : build complet OK.
- warning non bloquant observe :
  - `bullmq/dist/esm/classes/child-processor.js`
  - `Critical dependency: the request of a dependency is an expression`
  - trace : `src/redis/queues/grade.queue.ts` -> `ficheCentrales/fichecentrale.action.ts`.

## Definition of Done

- `app/page.tsx` ne contient plus la grosse logique Prisma.
- Les fallbacks sont centralises dans le module serveur.
- La page publique build correctement.
