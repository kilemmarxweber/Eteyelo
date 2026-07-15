# Phase 08 - Tests automatises et documentation

**Statut : terminee**

## Objectif

Securiser le comportement des permissions et du routage avec des tests automatises, et documenter les flux de roles.

## Livrables

### Tests unitaires

| Fichier | Couverture |
|---------|------------|
| `scripts/test-organizations-permissions.ts` | `lib/permissions.ts`, `organization-access.ts`, guards membres, matrices AC, payload API |
| `scripts/test-post-login-routing.ts` | Matrice routage post-login |

### Helpers testables

- `lib/auth/post-login-routing.ts` — fonctions pures extraites de `post-login-redirect.ts`
- `isOrganizationManagerMember()` exporte depuis `require-organization-permission.ts`
- `buildOrganizationsApiPayload()` — forme de reponse `/api/organizations`

### Documentation

- `context/organisations-roles-flow.md` — diagrammes et processus Better Auth
- `context/README.md` — section organisations et permissions

## Commandes

```bash
pnpm test:organizations-permissions
pnpm test:post-login-routing
pnpm test:organizations
pnpm test
```

`pnpm test` execute aussi la suite bulletin existante.

## Matrice routage testee

| Role | Destination |
|------|-------------|
| `owner` (app) | `/admin` |
| `admin` (app) | `/admin/organizations/{orgId}` |
| `user` + branche | `/admin/organizations/{orgId}/branches/{branchId}` |
| `user` multi-branches | `/admin/organizations/{orgId}/branch-picker` |
| ecodim | `/admin/organizations/{orgId}/ecodim` |
| `platform_support` | `/admin/platform-support` |

## Validation

```bash
pnpm test:organizations
npx tsc --noEmit
npm run build
```

## Prochaine etape

Plan organisations et permissions termine. Maintenance continue via les tests `pnpm test:organizations`.
