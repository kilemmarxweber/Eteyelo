# Phase 03 - UI organisations complete (CRUD)

**Statut : terminee**

## Objectif

Exposer dans l'interface les actions CRUD conformes aux permissions.

## Livrables

### Liste organisations (`organizations-view.tsx`)

- Badge role utilisateur (`OrganizationRoleBadge`)
- Bouton supprimer par organisation (`canDelete` par carte)
- Confirmation avant suppression (`DeleteOrganizationDialog`)
- Visible uniquement pour `APP_ROLE.OWNER` ou `ORG_ROLE.OWNER` membre

### Page organisation (`organization-home-view.tsx`)

- Badge role membre courant
- Bouton supprimer visible si `canDelete` (masque pour admin/gestionnaire)
- Pas d'action delete pour `APP_ROLE.ADMIN`

### Actions serveur (`app/admin/organizations/actions.ts`)

- `deleteOrganizationAction()` — guard `guardOrganizationDelete`, prisma pour owner plateforme, Better Auth pour owner org
- `getOrganizationAccessAction()` — metadonnees access pour detail org

### Composants

- `components/organization-role-badge.tsx`
- `components/delete-organization-dialog.tsx`

### Helpers

- `lib/auth/role-labels.ts` — libelles roles app et membre
- `canDeleteSpecificOrganization()` — delete par org dans `organization-access.ts`

### API enrichie

- `GET /api/organizations` — `roleLabel`, `canDelete` par org
- `GET /api/organizations/[id]` — `canDelete`, `canUpdate`, `roleLabel`

### Formulaire creation

- Guard serveur deja en place (`new/page.tsx`)
- Redirect vers `/admin/organizations` apres creation

### Top bar

- Deja sur `/api/organizations` via `useOrganizationsAccess`

## Validation

```bash
npx tsc --noEmit
npm run lint
```

## Tests manuels

1. Owner cree une org -> apparait dans la liste globale
2. Admin ne voit pas le bouton supprimer org
3. Owner supprime une org -> disparait de la liste
4. Badge role affiche sur liste et detail org
5. Confirmation obligatoire avant suppression

## Prochaine etape

[Phase 04 - Permissions membres Better Auth](./plan-gestion-organisations-permissions.md#phase-04---permissions-membres-better-auth-ac)
