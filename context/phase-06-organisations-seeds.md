# Phase 06 - Seeds et comptes de demonstration

**Statut : terminee**

## Objectif

Fournir des comptes de test pour chaque role avec roles et destinations post-login coherents.

## Livrables

### Comptes cibles

| Email | User.role | Member.role | Destination |
|-------|-----------|-------------|-------------|
| `owner@eteyelo.cd` | `owner` | (aucun) | `/admin` |
| `admin@eteyelo.cd` | `admin` | `gestionnaire` | `/admin/organizations/org_eteyelo_demo` |
| `prof.*@eteyelo.cd` | `user` | `teacher` | branche |
| `*@parent.cd` | `user` | `parent` | branche |
| `*@eleve.cd` | `user` | `student` | branche |
| `support@klambocore.cd` | `platform_support` | (aucun) | `/admin/platform-support` |

### Fichiers

- `prisma/seeds/initUsers.ts` — owner + admin + users branche
- `prisma/seeds/initPlatformOwner.ts` — owner sans membership org
- `prisma/seeds/initAdmin.ts` — admin en `gestionnaire` membre
- `prisma/seeds/initPlatformSupport.ts` — `support@klambocore.cd` + agents dev
- `prisma/seeds/demoAccounts.ts` — reference centralisee + `printDemoAccounts()`
- `prisma/seeds/README.md` — mots de passe et destinations documentes
- `prisma.config.ts` — `npx prisma db seed` configure

### Corrections

- Emails enseignants : `prof.*@eteyelo.cd` (au lieu de `nom@eteyelo.cd`)
- Support demo : `support@klambocore.cd` / `Support123!`
- Agents support : aucun membership organisation
- `quickDemo.ts` : seed minimal complet par role

## Validation

```bash
npx prisma db seed
# ou
pnpm run seed:all
pnpm run seed:demo
```

## Tests manuels

1. `owner@eteyelo.cd` -> `/admin`
2. `admin@eteyelo.cd` -> `/admin/organizations/org_eteyelo_demo`
3. `prof.mukendi@eteyelo.cd` -> branche
4. `kasongo@parent.cd` -> branche
5. `kasongo.junior@eleve.cd` -> branche
6. `support@klambocore.cd` -> `/admin/platform-support`

## Prochaine etape

[Phase 07 - Migration donnees existantes](./plan-gestion-organisations-permissions.md#phase-07---migration-donnees-existantes)
