# Phase 07 - Migration donnees existantes

**Statut : terminee**

## Objectif

Corriger les utilisateurs existants en base qui utilisent encore l'ancien modele de roles.

## Livrables

### Script TypeScript (`lib/auth/migrate-organization-roles.ts`)

Migration idempotente avec rapport avant/apres :

1. **Admin org mal classe** — `User.role = admin` + `Member.role = owner` -> `gestionnaire`
2. **Super admins legacy** — `User.role = admin` sans membership -> `owner` plateforme
3. **Memberships dupliques** — garde la plus ancienne (ou celle de l'admin org), supprime les autres
4. **Owners plateforme** — retire toute membership organisation
5. **Owner manquant** — cree `owner@eteyelo.cd` si aucun `User.role = owner`

### CLI (`scripts/migrate-organization-roles.ts`)

```bash
pnpm run migrate:org-roles:audit      # audit lecture seule
pnpm run migrate:org-roles:dry-run    # simulation
pnpm run migrate:org-roles            # applique la migration
```

### SQL de reference (`prisma/scripts/migrate-organization-roles.sql`)

Equivalents SQL manuels pour audit ou execution DBA.

## Regles appliquees

| Situation | Action |
|-----------|--------|
| `admin` app + `owner` membre | `Member.role` -> `gestionnaire` |
| `admin` app sans membership | `User.role` -> `owner` |
| Plusieurs memberships | Garde 1, supprime les doublons |
| `owner` app avec membership | Supprime le membership |
| Aucun owner plateforme | Cree `owner@eteyelo.cd` |

## Validation

```bash
npx tsc --noEmit
pnpm run migrate:org-roles:audit
pnpm run migrate:org-roles:dry-run
pnpm run migrate:org-roles
```

## Tests manuels post-migration

1. Audit : `usersWithMultipleMemberships = 0`
2. Audit : `appAdminsWithMemberOwner = 0`
3. Connexion comptes existants -> bonne destination
4. Owner plateforme sans membership org

## Prochaine etape

[Phase 08 - Tests automatises et documentation](./plan-gestion-organisations-permissions.md#phase-08---tests-automatises-et-documentation)
