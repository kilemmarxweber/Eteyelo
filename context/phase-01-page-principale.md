# Phase 01 - Page publique principale

## Objectif

Rendre `app/page.tsx` plus maintenable en separant la logique serveur, les donnees fallback et les composants visuels.

## Portee

- `app/page.tsx`
- `lib/home/home-data.ts` ou `app/home/home.data.ts`
- composants sous `components/home/`

## Actions

1. Extraire les types de donnees de la page d'accueil.
2. Extraire les donnees fallback : ecoles, evenements, partenaires, galerie.
3. Extraire `getHomeData()` dans un module serveur dedie.
4. Gerer les erreurs Prisma avec fallback clair.
5. Decider la strategie de cache :
   - `dynamic = "force-dynamic"` si donnees toujours fraiches ;
   - `revalidate` si refresh periodique acceptable.
6. Garder `app/page.tsx` comme orchestration simple.
7. Decouper les grandes sections UI si le fichier reste trop long.

## Bonnes pratiques

- Garder les fonctions data cote serveur.
- Ne pas importer Prisma dans les composants client.
- Eviter les transformations complexes directement dans le JSX.
- Garder les images fallback normalisees.

## Securite

- Ne pas exposer des donnees internes non publiques.
- Limiter les champs Prisma selectionnes.
- Continuer a filtrer les branches/partenaires actifs.

## Tests manuels

- Ouvrir la page publique avec donnees en base.
- Ouvrir la page publique avec peu ou pas de donnees.
- Verifier les images branches/partenaires.
- Verifier les resultats affiches.

## Validation avant passage

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- `app/page.tsx` ne contient plus la grosse logique Prisma.
- Les fallbacks fonctionnent.
- La page publique build correctement.
