# Phase 05 - Routage et navigation coherents

**Statut : terminee**

## Objectif

Uniformiser la navigation selon le role dans toute l'application.

## Livrables

### Sidebar (`lib/sidebar-menu.ts`)

- Suppression de l'override « admin voit tout » dans `canSeeMenu`
- Separation des roles plateforme (`PLATFORM_MENU_ROLES`) et gestion org (`ORG_MANAGER_MENU_ROLES`)
- `resolveNavigationContext()` : platform / organization / branch
- Filtrage des roles plateforme pour les utilisateurs branche (`APP_ROLE.USER`)

### Navigation mobile (`components/layout/mobile-nav.tsx`)

| Role | Navigation |
|------|------------|
| `APP_ROLE.OWNER` | Accueil `/admin` + Organisations |
| `APP_ROLE.ADMIN` | Organisation + Branches |
| `APP_ROLE.PLATFORM_SUPPORT` | Support plateforme |
| Roles ecodim | Nav ecodim |
| Utilisateurs branche | Accueil branche + Resultats/Horaire selon role |

Nav mobile ajoutee aussi sur les routes branche (`client-layout.tsx`).

### Garde admin (`lib/auth/enforce-admin-route-access.ts`)

- Verification role minimale dans `app/admin/layout.tsx`
- `APP_ROLE.USER` redirige vers sa branche/ecodim s'il tente `/admin` sans droit
- `APP_ROLE.ADMIN` limite a son `organizationId`
- Chemins universels : `/admin/account`, `/admin/settings`, `/admin/help`
- Middleware injecte `x-pathname` pour le guard serveur

### Multi-branches (`lib/auth/user-branch-access.ts`)

- `getUserBranchMemberships()` — liste des branches utilisateur
- `resolveActiveBranchId()` — reutilise `activeBranchId` session si valide
- Page `/admin/organizations/{orgId}/branch-picker` si plusieurs branches
- `switchBranchAction` persiste `activeBranchId`

### Post-login (`lib/auth/post-login-redirect.ts`)

- Reutilise `activeBranchId` de session
- Redirige vers branch-picker si plusieurs branches sans preference valide

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Tests manuels

1. Owner voit nav plateforme (desktop + mobile)
2. Admin voit nav organisation, pas `/admin` dashboard
3. Enseignant/parent/eleve rediriges vers leur branche
4. Parent multi-branches -> page de choix
5. Reconnexion -> meme destination (activeBranchId conserve)

## Prochaine etape

[Phase 06 - Seeds et comptes de demonstration](./plan-gestion-organisations-permissions.md#phase-06---seeds-et-comptes-de-demonstration)
