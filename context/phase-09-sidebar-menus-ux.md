# Phase 09 - Sidebar, menus et UX

## Objectif

Ameliorer la navigation et l'experience sans refaire toute l'UI.

## Portee

- `lib/sidebar-menu.ts`
- `components/sidebar.tsx`
- layout branche
- boutons principaux des pages
- menus adaptes au type de branche

## Actions

1. Ajouter `Inscription` comme menu principal.
2. Retirer `Inscriptions` du sous-menu `Classes`.
3. Masquer `Sections` et `Options` pour les branches primaires.
4. Conserver `Sections` et `Options` pour les branches secondaires.
5. Corriger l'etat actif de la sidebar.
6. Corriger les dysfonctionnements mobile/desktop.
7. Normaliser l'emplacement des boutons principaux.
8. Remplacer les boutons supprimer par archiver/desactiver.

## Bonnes pratiques

- La sidebar doit etre derivee du contexte courant.
- Ne pas hardcoder des routes sans `organizationId`/`branchId`.
- Les actions importantes doivent etre accessibles mais pas envahissantes.
- Les boutons dangereux doivent avoir confirmation et libelle clair.

## Securite

- Filtrer les menus selon role.
- Filtrer les menus selon type de branche.
- Ne pas cacher seulement cote client si l'action serveur reste accessible sans protection.

## Tests manuels

- Branch primaire : pas section/option.
- Branch secondaire : section/option visibles.
- Inscription visible comme menu principal.
- Navigation active correcte.
- Sidebar mobile stable.

## Validation avant passage

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Sidebar coherente.
- Menus adaptes au type de branche.
- UX plus claire sur les actions principales.
