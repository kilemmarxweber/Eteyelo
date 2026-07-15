# Phase 01 - Fondations permissions et routage

**Statut : terminee**

## Objectif

Poser le modele de roles correct et corriger les bugs bloquants de permissions et routage post-connexion.

## Livrables

### Permissions (`lib/permissions.ts`)

- `isPlatformOwnerRole()` — detecte le role root `owner`
- `APP_ROLE.OWNER` — CRUD complet plateforme + organisations
- `APP_ROLE.ADMIN` — CRU uniquement (sans delete)
- `isOrganizationManagerAppRole()` — helper gestionnaire org

### Better Auth (`lib/auth.ts`)

- `allowUserToCreateOrganization` — reserve au owner plateforme
- `organizationLimit` — owner illimite, admin/support bloques, user max 1
- `adminRoles` — `[APP_ROLE.OWNER, APP_ROLE.PLATFORM_SUPPORT]`

### Acces organisations (`lib/auth/organization-access.ts`)

- `listOrganizationsForUser()` — toutes les orgs pour owner, memberships pour les autres
- `canAccessOrganization()` — verification d'acces par org
- `getOrganizationByIdForUser()` — detail org avec controle d'acces
- `canCreateOrganization()` / `canDeleteOrganization()` — guards CRUD

### API

- `GET /api/organizations` — liste role-aware
- `GET /api/organizations/[organizationId]` — detail org avec controle d'acces

### Hook client (`lib/hooks/use-organizations-access.ts`)

- `useOrganizationsAccess()` — remplace `useListOrganizations` pour le owner
- `useOrganizationById()` — charge une org avec verification serveur

### Routage post-login (`lib/auth/post-login-redirect.ts`)

| Role | Destination |
|------|-------------|
| `owner` | `/admin` |
| `admin` | `/admin/organizations/{orgId}` |
| `user` | `/admin/organizations/{orgId}/branches/{branchId}` |
| `platform_support` | `/admin/platform-support` |

Parents et eleves sont maintenant routes vers leur branche (pas seulement les enseignants).

### UI

- `organizations-view.tsx` — liste via API, bouton creer reserve au owner
- `[organizationId]/page.tsx` — detail org accessible au owner sans membership
- `new/page.tsx` — guard serveur, seul le owner peut creer
- `admin-top-bar.tsx` — titres org via API role-aware

### Seeds

- `owner@eteyelo.cd` / `Owner123!` — role `owner` (sans membership)
- `admin@eteyelo.cd` / `Admin123!` — role `admin`, member `gestionnaire`

## Validation

```bash
npx tsc --noEmit
npm run lint
```

## Tests manuels

1. Connexion `owner@eteyelo.cd` -> `/admin`
2. Page organisations -> toutes les orgs visibles
3. Bouton "Creer une organisation" visible uniquement pour owner
4. Owner ouvre une org -> page detail OK (plus "Organisation introuvable")
5. Connexion `admin@eteyelo.cd` -> `/admin/organizations/{orgId}`
6. Connexion `prof.*@eteyelo.cd` -> branche enseignant
7. Connexion `parent.*@parent.cd` -> branche parent
8. Connexion `eleve.*@eleve.cd` -> branche eleve
9. Admin tente `/admin/organizations/new` -> redirect liste

## Prochaine etape

[Phase 02 - Garde-fous serveur](./plan-gestion-organisations-permissions.md#phase-02---garde-fous-serveur-sur-les-organisations)
