# Plan d'action - Gestion des organisations et permissions

Ce document decoupe la refonte des roles, permissions et routage post-connexion en phases testables. Il s'appuie sur Better Auth (plugins `admin` + `organization`) et sur la logique existante du projet Eteyelo.

## Modele cible

### Roles applicatifs (`User.role`)

| Role | Slug | Description | Routage post-login |
|------|------|-------------|-------------------|
| Proprietaire plateforme | `owner` | Root Klambocore, voit et gere toutes les organisations | `/admin` |
| Gestionnaire organisation | `admin` | CRU sur son organisation uniquement (pas de suppression) | `/admin/organizations/{orgId}` |
| Utilisateur simple | `user` | Acces branche selon son role membre | `/admin/organizations/{orgId}/branches/{branchId}` |
| Support plateforme | `platform_support` | Agent Klambocore | `/admin/platform-support` |

### Roles organisation (`Member.role`)

| Role | Slug | Permissions |
|------|------|-------------|
| Proprietaire org | `owner` | Toutes les permissions sur son organisation (CRUD complet) |
| Gestionnaire org | `gestionnaire` | Gestion complete de son organisation (sans suppression de l'org) |
| Enseignant | `teacher` | Acces branche enseignant |
| Parent | `parent` | Acces branche parent |
| Eleve | `student` | Acces branche eleve |
| Ecodim | `responsable`, `moniteur`, `surveillant` | Acces module ecodim |

### Matrice des permissions applicatives

| Action | `owner` (app) | `admin` (app) | `user` (app) |
|--------|---------------|---------------|--------------|
| Lister toutes les orgs | Oui | Non (sa org seulement) | Non (sa org seulement) |
| Creer une organisation | Oui | Non | Non |
| Lire une organisation | Oui (toutes) | Oui (la sienne) | Oui (la sienne) |
| Modifier une organisation | Oui (toutes) | Oui (la sienne) | Non |
| Supprimer une organisation | Oui | Non | Non |

## Etat actuel (corrige en Phase 01)

Corrections deja appliquees :

- `isPlatformOwnerRole()` ajoute dans `lib/permissions.ts`
- `APP_ROLE.OWNER` ajoute dans `applicationRoleStatements` (CRUD complet)
- `APP_ROLE.ADMIN` restreint a CRU (sans delete)
- `lib/auth/organization-access.ts` cree (liste orgs, guards)
- `app/api/organizations/route.ts` cree (API liste role-aware)
- `lib/auth/post-login-redirect.ts` corrige (owner -> /admin, admin -> org, user -> branche)
- `app/admin/organizations/organizations-view.tsx` affiche toutes les orgs pour owner
- Seeds : utilisateur `owner@eteyelo.cd`, admin seed en `gestionnaire` membre

---

## Phase 01 - Fondations permissions et routage

**Statut : implementee**

### Objectif

Poser le modele de roles correct et corriger les bugs bloquants.

### Fichiers touches

- `lib/permissions.ts`
- `lib/auth.ts`
- `lib/auth/organization-access.ts`
- `lib/auth/post-login-redirect.ts`
- `lib/auth/session-roles.ts`
- `lib/support/permissions.ts`
- `app/api/organizations/route.ts`
- `app/admin/organizations/page.tsx`
- `app/admin/organizations/organizations-view.tsx`
- `prisma/seeds/initUsers.ts`
- `prisma/seeds/initAdmin.ts`

### Validation

```bash
npx tsc --noEmit
npm run lint
```

### Tests manuels

1. Connexion `owner@eteyelo.cd` -> redirection `/admin`
2. Page organisations -> affiche toutes les orgs
3. Bouton "Creer une organisation" visible pour owner uniquement
4. Connexion `admin@eteyelo.cd` -> redirection `/admin/organizations/{orgId}`
5. Connexion `prof.*@eteyelo.cd` -> redirection vers sa branche
6. Connexion `parent.*@parent.cd` -> redirection vers sa branche
7. Connexion `eleve.*@eleve.cd` -> redirection vers sa branche

---

## Phase 02 - Garde-fous serveur sur les organisations

**Statut : implementee** — voir [resultat Phase 02](./phase-02-organisations-garde-fous.md)

### Actions

1. Creer `lib/auth/require-organization-permission.ts` :
   - `requirePlatformOwner()` pour actions globales
   - `requireOrganizationAccess(orgId)` pour verifier l'appartenance
   - `requireOrganizationManager(orgId)` pour CRU
   - `requireOrganizationDelete(orgId)` pour suppression

2. Proteger les routes sensibles :
   - `app/admin/organizations/[organizationId]/members/actions.ts`
   - `app/admin/organizations/[organizationId]/branches/(no-layout)/branche.action.ts`
   - Toute action `organization.delete` ou `member.remove`

3. Ajouter un middleware ou guard dans :
   - `app/admin/organizations/[organizationId]/layout.tsx`
   - Verifier que `APP_ROLE.ADMIN` ne peut acceder qu'a son `organizationId`

### Regles

- `APP_ROLE.OWNER` : bypass membership, acces a toute org
- `APP_ROLE.ADMIN` : acces uniquement si `member.organizationId === orgId`
- `APP_ROLE.USER` : acces branche uniquement (pas aux pages org admin)

### Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```

### Tests manuels

1. Admin tente d'acceder a une autre org -> 403 ou redirect
2. User tente d'acceder a `/admin/organizations` -> redirect branche
3. Owner accede a n'importe quelle org -> OK

---

## Phase 03 - UI organisations complete (CRUD)

**Statut : implementee** — voir [resultat Phase 03](./phase-03-organisations-crud-ui.md)

### Actions

1. Page liste organisations (`organizations-view.tsx`) :
   - Badge role (owner/admin/user)
   - Bouton supprimer visible uniquement pour `APP_ROLE.OWNER` ou `ORG_ROLE.OWNER`
   - Confirmation avant suppression

2. Page organisation `[organizationId]/page.tsx` :
   - Masquer actions delete pour `APP_ROLE.ADMIN`
   - Afficher role membre courant

3. Formulaire creation (`create-organization-form.tsx`) :
   - Guard serveur : seul owner peut creer
   - Redirect owner vers liste apres creation

4. Top bar (`components/layout/admin-top-bar.tsx`) :
   - Utiliser `/api/organizations` au lieu de `useListOrganizations` pour owner

### Validation

```bash
npx tsc --noEmit
npm run build
```

### Tests manuels

1. Owner cree une org -> apparait dans la liste globale
2. Admin ne voit pas le bouton supprimer org
3. Owner supprime une org -> disparait de la liste

---

## Phase 04 - Permissions membres (Better Auth AC)

**Statut : implementee** — voir [resultat Phase 04](./phase-04-organisations-permissions-membres.md)

### Objectif

Aligner les permissions membres avec Better Auth `hasPermission`.

### Actions

1. Utiliser `auth.api.hasPermission` dans les actions membres :
   ```typescript
   await auth.api.hasPermission({
     headers,
     body: {
       permissions: { member: ["create"] },
       organizationId,
     },
   });
   ```

2. Verifier la matrice AC dans `lib/permissions.ts` :
   - `ORG_ROLE.OWNER` : CRUD member, branch, invitation
   - `ORG_ROLE.GESTIONNAIRE` : CRU member (pas delete org)
   - Roles branche : read seulement sur member/org

3. Page roles (`app/admin/organizations/[organizationId]/roles/page.tsx`) :
   - Afficher clairement la difference owner/gestionnaire/user

4. Dynamic AC (`OrganizationRole` table) :
   - Documenter quand utiliser les overrides par org

### Validation

```bash
npx tsc --noEmit
npm run build
```

### Tests manuels

1. Gestionnaire ajoute un membre -> OK
2. Gestionnaire supprime un membre -> OK
3. Enseignant tente d'ajouter un membre -> refuse
4. Owner plateforme gere les membres de toute org -> OK

---

## Phase 05 - Routage et navigation coherents

**Statut : implementee** — voir [resultat Phase 05](./phase-05-organisations-navigation.md)

### Objectif

Uniformiser la navigation selon le role dans toute l'application.

### Actions

1. `lib/sidebar-menu.ts` :
   - Separer menus owner plateforme vs gestionnaire org vs utilisateur branche
   - Retirer l'override "admin voit tout" pour `APP_ROLE.USER`

2. `components/layout/mobile-nav.tsx` :
   - Owner : nav admin complete
   - Admin : nav org (pas platform-support sauf si agent)
   - User : nav branche ou ecodim

3. `app/admin/layout.tsx` :
   - Ajouter verification role minimale
   - Redirect user vers sa branche s'il tente `/admin` sans droit

4. `lib/auth/post-login-redirect.ts` :
   - Gerer le cas multi-branches (choix si plusieurs)
   - Persister `activeBranchId` pour parents/eleves

### Validation

```bash
npx tsc --noEmit
npm run build
```

### Tests manuels

1. Chaque role voit uniquement ses menus
2. Navigation mobile coherente avec desktop
3. Retour apres deconnexion/reconnexion -> bonne destination

---

## Phase 06 - Seeds et comptes de demonstration

**Statut : implementee** — voir [resultat Phase 06](./phase-06-organisations-seeds.md)

### Objectif

Fournir des comptes de test pour chaque role.

### Comptes cibles

| Email | User.role | Member.role | Destination |
|-------|-----------|-------------|-------------|
| `owner@eteyelo.cd` | `owner` | (aucun) | `/admin` |
| `admin@eteyelo.cd` | `admin` | `gestionnaire` | `/admin/organizations/{orgId}` |
| `prof.*@eteyelo.cd` | `user` | `teacher` | branche |
| `parent.*@parent.cd` | `user` | `parent` | branche |
| `eleve.*@eleve.cd` | `user` | `student` | branche |
| `support@klambocore.cd` | `platform_support` | (aucun) | `/admin/platform-support` |

### Actions

1. Verifier `prisma/seeds/initUsers.ts` (owner ajoute)
2. Verifier `prisma/seeds/initAdmin.ts` (gestionnaire)
3. Ajouter `prisma/seeds/initPlatformOwner.ts` si besoin d'init dedie
4. Documenter les mots de passe dans le README seeds

### Validation

```bash
npx prisma db seed
```

Puis tester chaque compte manuellement.

---

## Phase 07 - Migration donnees existantes

**Statut : implementee** — voir [resultat Phase 07](./phase-07-organisations-migration-donnees.md)

### Objectif

Corriger les utilisateurs existants en base qui ont l'ancien modele.

### Actions

1. Script migration :
   - Identifier les `User.role = admin` avec `Member.role = owner`
   - Convertir `Member.role` en `gestionnaire` si l'intention est gestionnaire org
   - Creer un compte `owner` plateforme si absent

2. Verifier qu'aucun utilisateur n'a plusieurs memberships (regle `assertUserCanJoinOrganization`)

3. Mettre a jour `User.role` des anciens "super admins" vers `owner`

### Script suggere

```sql
-- Exemple : convertir admin org owner en gestionnaire
UPDATE member SET role = 'gestionnaire'
WHERE role = 'owner'
AND user_id IN (SELECT id FROM "user" WHERE role = 'admin');
```

### Validation

- Audit manuel des comptes en base
- Tests de connexion post-migration

---

## Phase 08 - Tests automatises et documentation

**Statut : implementee** — voir [resultat Phase 08](./phase-08-organisations-tests.md)

### Objectif

Securiser le comportement avec des tests et documenter le processus.

### Actions

1. Tests unitaires :
   - `lib/permissions.ts` (isPlatformOwnerRole, matrices AC)
   - `lib/auth/post-login-redirect.ts` (matrice routage)
   - `lib/auth/organization-access.ts` (canListAll, canDelete)

2. Tests integration :
   - API `/api/organizations` avec sessions simulees
   - Guards `require-organization-permission`

3. Documentation :
   - Ajouter section dans `context/README.md`
   - Diagramme des flux de roles

### Validation

```bash
npm test
npx tsc --noEmit
npm run build
```

---

## Processus Better Auth recommande

### 1. Configuration (`lib/auth.ts`)

```typescript
admin({
  ac: authAccessControl,
  defaultRole: APP_ROLE.USER,
  adminRoles: [APP_ROLE.OWNER, APP_ROLE.PLATFORM_SUPPORT],
  roles: applicationRoles,
}),
organization({
  ac: authAccessControl,
  creatorRole: ORG_ROLE.OWNER,
  allowUserToCreateOrganization: (user) => isPlatformOwnerRole(user.role),
  organizationLimit: async (user) => {
    if (isPlatformOwnerRole(user.role)) return false; // illimite
    if (isAppAdminRole(user.role)) return true;       // bloque
    return count >= 1;                               // 1 max pour user
  },
  roles: organizationRoles,
  dynamicAccessControl: { enabled: true },
}),
```

### 2. Verification permissions cote serveur

```typescript
// Option A : helper custom
import { canAccessOrganization } from "@/lib/auth/organization-access";

// Option B : Better Auth natif
const { success } = await auth.api.hasPermission({
  headers: await headers(),
  body: {
    permissions: { organization: ["update"] },
    organizationId,
  },
});
```

### 3. Session enrichie (`customSession`)

La session expose :
- `user.role` : role applicatif
- `organization.role` : role membre dans l'org active
- `organization.id` : org active
- `branch` : branche active
- `teacherContext` : contexte enseignant

### 4. Routage post-login

```
owner (app)        -> /admin
admin (app)        -> /admin/organizations/{orgId}
user (app)         -> /admin/organizations/{orgId}/branches/{branchId}
platform_support   -> /admin/platform-support
```

### 5. Liste organisations

- **Owner** : `prisma.organization.findMany()` (toutes)
- **Autres** : `prisma.member.findMany({ where: { userId } })` (memberships)

Ne pas utiliser `authClient.useListOrganizations()` pour le owner plateforme.

---

## Diagramme des flux

```mermaid
flowchart TD
    A[Connexion] --> B{User.role?}
    B -->|owner| C[/admin]
    B -->|admin| D[/admin/organizations/orgId]
    B -->|user| E{Member.role?}
    B -->|platform_support| F[/admin/platform-support]
    E -->|teacher/parent/student| G[/admin/organizations/orgId/branches/branchId]
    E -->|responsable/moniteur/surveillant| H[/admin/organizations/orgId/ecodim]
    E -->|owner/gestionnaire| D
```

---

## Definition of Done globale

- TypeScript, lint et build passent
- Chaque role a le bon routage post-login
- Owner voit toutes les organisations
- Admin (app) gere uniquement son organisation (CRU)
- User est route vers sa branche
- Suppression organisation reservee au owner
- Seeds fournissent un compte par role
- Guards serveur sur toutes les actions sensibles

## Ordre d'execution recommande

1. Phase 01 (fait)
2. Phase 02 - Garde-fous serveur
3. Phase 05 - Navigation (en parallele partiel avec 02)
4. Phase 03 - UI CRUD
5. Phase 04 - Permissions membres Better Auth
6. Phase 06 - Seeds
7. Phase 07 - Migration donnees
8. Phase 08 - Tests et documentation
