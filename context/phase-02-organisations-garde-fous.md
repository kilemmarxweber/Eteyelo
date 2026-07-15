# Phase 02 - Garde-fous serveur sur les organisations

**Statut : terminee**

## Objectif

Proteger les actions serveur et les pages sensibles avec des verifications explicites par role.

## Livrables

### Module central (`lib/auth/require-organization-permission.ts`)

- `guardPlatformOwner()` / `requirePlatformOwner`
- `guardOrganizationAccess()` / `requireOrganizationAccess`
- `guardOrganizationManager()` / `requireOrganizationManager`
- `guardOrganizationDelete()` / `requireOrganizationDelete`
- `guardOrganizationBranchAccess()` — acces branche pour users
- `enforceOrganizationSectionAccess()` — layout org (admin scope a son orgId)
- `enforceOrganizationManagerPage()` — pages gestion org
- `enforceOrganizationListPage()` — liste org (owner/admin seulement)
- `enforceOrganizationBranchPage()` — layout branche

### Helper routage (`lib/auth/resolve-user-organization-path.ts`)

- `getUserBranchId()` — partage avec post-login
- `resolveUserOrganizationFallbackPath()` — redirect users vers leur branche

### Layouts proteges

| Fichier | Guard |
|---------|-------|
| `[organizationId]/layout.tsx` | `enforceOrganizationSectionAccess` |
| `[organizationId]/page.tsx` | `enforceOrganizationManagerPage` |
| `organizations/page.tsx` | `enforceOrganizationListPage` |
| `members/layout.tsx` | `enforceOrganizationManagerPage` |
| `roles/layout.tsx` | `enforceOrganizationManagerPage` |
| `support/layout.tsx` | `enforceOrganizationManagerPage` |
| `rapport/layout.tsx` | `enforceOrganizationManagerPage` |
| `partenaires/layout.tsx` | `enforceOrganizationManagerPage` |
| `branches/(no-layout)/page.tsx` | `enforceOrganizationManagerPage` |
| `branches/(no-layout)/new/page.tsx` | `enforceOrganizationManagerPage` |
| `branches/(no-layout)/edit/page.tsx` | `enforceOrganizationManagerPage` |
| `branches/.../[branchId]/layout.tsx` | `enforceOrganizationBranchPage` |

### Actions serveur protegees

- `members/actions.ts` — create, update, remove membres
- `branche.action.ts` — create, update, setActive branche
- `rapport/rapport.action.ts` — lecture rapports org

## Regles appliquees

| Role | Comportement |
|------|--------------|
| `owner` (app) | Acces a toute org, toutes actions |
| `admin` (app) | Acces uniquement a son `organizationId` |
| `user` (app) | Redirect depuis liste org et pages gestion ; acces branche si membre |

## Validation

```bash
npx tsc --noEmit
npm run lint
```

## Tests manuels

1. Admin tente d'acceder a une autre org -> redirect vers sa org
2. User tente `/admin/organizations` -> redirect vers sa branche
3. User tente `/admin/organizations/{orgId}/members` -> redirect branche
4. Owner accede a n'importe quelle org -> OK
5. Enseignant accede a sa branche -> OK
6. Actions membres/branches refusees sans droit gestionnaire

## Prochaine etape

[Phase 03 - UI organisations complete (CRUD)](./plan-gestion-organisations-permissions.md#phase-03---ui-organisations-complete-crud)
