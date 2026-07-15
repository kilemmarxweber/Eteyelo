# Phase 04 - Permissions membres (Better Auth AC)

**Statut : terminee**

## Objectif

Aligner les actions membres avec le controle d'acces Better Auth (`auth.api.hasPermission`) et clarifier la matrice des roles organisation.

## Livrables

### Helper permissions (`lib/auth/has-organization-permission.ts`)

- `checkOrganizationPermission(orgId, permissions)` — appelle `auth.api.hasPermission`
- `guardOrganizationMemberPermission(orgId, permissions)` — acces org + permission membre
- Bypass automatique pour `APP_ROLE.OWNER` (non membre de l'org)

### Operations membres (`lib/auth/organization-member-operations.ts`)

- `updateOrganizationMemberRole()` — Better Auth ou Prisma si owner plateforme sans membership
- `removeOrganizationMember()` — idem (Better Auth exige d'etre membre pour `removeMember`)

### Actions membres (`members/actions.ts`)

| Action | Permission verifiee |
|--------|-------------------|
| `createOrganizationMemberAction` | `member: ["create"]` |
| `updateOrganizationMemberAction` | `member: ["update"]` |
| `removeOrganizationMemberAction` | `member: ["delete"]` |

Remplace `guardOrganizationManager` par `guardOrganizationMemberPermission`.

### Matrice AC (`lib/permissions.ts`)

- `ORG_ROLE.OWNER` : CRUD organisation, membres, invitations (preset `ownerAc`)
- `ORG_ROLE.GESTIONNAIRE` : `organization: ["update"]` sans delete, `member` CRUD explicite
- Roles branche : `member: ["read"]` uniquement
- `ORGANIZATION_ROLE_GROUPS` pour la page roles

### Page roles (`roles/page.tsx`)

- Regroupement : Gestion / Acces branche / Support
- Section Dynamic AC (`OrganizationRole` table)

## Dynamic AC

Better Auth `dynamicAccessControl.enabled` est actif dans `lib/auth.ts`.

La table `OrganizationRole` stocke des overrides JSON par `(organizationId, role)` :

- Utiliser pour des besoins specifiques a un etablissement
- Ne pas dupliquer les presets statiques sans raison
- Les actions serveur passent par `hasPermission` qui prend en compte les overrides

## Validation

```bash
npx tsc --noEmit
npm run lint
```

## Tests manuels

1. Gestionnaire ajoute un membre -> OK
2. Gestionnaire supprime un membre -> OK
3. Enseignant tente d'ajouter un membre -> refuse (pas acces page + permission)
4. Owner plateforme gere les membres de toute org -> OK (bypass + Prisma si non membre)

## Prochaine etape

[Phase 05 - Routage et navigation coherents](./plan-gestion-organisations-permissions.md#phase-05---routage-et-navigation-coherents)
