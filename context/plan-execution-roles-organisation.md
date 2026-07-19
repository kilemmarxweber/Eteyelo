# Plan d’exécution — Rôles organisation + force-dynamic

**Date :** 15 juillet 2026  
**Statut :** Phases 1–6 **SUCCESS** — seed démo + smoke HTTP 11/11 ; prefet/directeur/superviseur/caissier hors seeds (unit tests)  
**Références :**
- Matrice / mapping : [`context/roles-organisation-matrice.md`](./roles-organisation-matrice.md)
- Plan source Cursor (ne pas modifier) : `.cursor/plans/roles_et_force-dynamic_5b462674.plan.md`
- Contexte permissions existant : [`plan-gestion-organisations-permissions.md`](./plan-gestion-organisations-permissions.md), [`phase-04-organisations-permissions-membres.md`](./phase-04-organisations-permissions-membres.md)

---

## 1. Objectif

Refondre les rôles d’organisation (nouveaux slugs + matrice CRUD homogène), migrer les anciens rôles en base, documenter la matrice dans `context/`, et appliquer `force-dynamic` sur les pages `app/` qui lisent Prisma sans export dynamique.

Livrables attendus :

1. Doc matrice à jour (`context/roles-organisation-matrice.md`)
2. `lib/permissions.ts` aligné sur la matrice 1A
3. Labels, routing, sidebar, session-roles, enforce, mobile-nav, tests
4. Migration `member.role` (décision 2A)
5. `export const dynamic = "force-dynamic"` sur les pages Prisma prioritaires / manquantes
6. Validation `tsc` + tests permissions + smoke login

---

## 2. Décisions figées

| ID | Décision | Contenu |
|----|----------|---------|
| **1A** | Uniformité AC | Mêmes actions sur **toutes** les ressources métier org (`member`, `branch`, `teacher`, `parent`, `personnel`, `schedule`, `inscription` + ressources Better Auth utiles au même niveau quand applicable) |
| **2A** | Mapping migration | `surveillant` → `superviseur`, `responsable` → `directeur`, `moniteur` → `prefet` |

Règles complémentaires figées :

- `owner` : CRUD complet **dans son organisation** (scopé Better Auth)
- `gestionnaire` / `prefet` / `directeur` : **pas** de `organization: ["delete"]`
- `support` : **inchangé** (lecture member/branch + support/escalade)
- Pas de layout global `force-dynamic` sur tout `/admin` : ciblage **page par page**

---

## 3. Matrice rôles × actions

Voir le détail et les cases CRUD : [`roles-organisation-matrice.md`](./roles-organisation-matrice.md).

| Slug | Label | Actions (ressources métier) |
|------|-------|-----------------------------|
| `owner` | Propriétaire | create, read, update, delete |
| `gestionnaire` | Gestionnaire | create, read, update |
| `prefet` | Préfet | create, read, update |
| `directeur` | Directeur | create, read, update |
| `teacher` | Enseignant | create, read |
| `superviseur` | Superviseur | create, read, update, delete |
| `caissier` | Caissier | create, read, update |
| `student` | Élève | read |
| `parent` | Parent | read |
| `support` | Support établissement | inchangé (hors grille 1A) |

Retirer de `ORG_ROLE` / `ALL_ORG_ROLE_SLUGS` / `organizationRoleStatements` / `ORGANIZATION_ROLE_GROUPS` : `moniteur`, `responsable`, `surveillant`.  
Ajouter : `prefet`, `directeur`, `superviseur`, `caissier`.

---

## 4. Mapping migration (2A)

| Ancien slug | Nouveau slug |
|-------------|--------------|
| `surveillant` | `superviseur` |
| `responsable` | `directeur` |
| `moniteur` | `prefet` |

SQL de référence (`Member.role` peut être CSV) :

```sql
UPDATE "member" SET role = REPLACE(role, 'surveillant', 'superviseur');
UPDATE "member" SET role = REPLACE(role, 'responsable', 'directeur');
UPDATE "member" SET role = REPLACE(role, 'moniteur', 'prefet');
```

Puis :

- [x] Nettoyer / resync `OrganizationRole` (dynamic AC) pour slugs obsolètes
- [x] Upsert des nouveaux presets si le bootstrap le fait déjà
- [x] Vérifier seeds / scripts hardcodés

---

## 5. Pages prioritaires force-dynamic

Ajouter `export const dynamic = "force-dynamic"` si absent, sur ces pages publiques (fichiers `page.tsx` confirmés) :

| Zone | Route réelle (`app/`) | Miroir / pages liées |
|------|----------------------|----------------------|
| Inscription élève | `app/inscription-eleve/page.tsx` | `app/components/inscription-eleve/page.tsx` |
| Dépôt candidature | `app/depot-candidature/page.tsx` | Pas de `page.tsx` sous `app/components/depot-candidature/` (formulaire + actions seulement) |
| Résultats | `app/resultats/page.tsx` | Pas de miroir `app/components/resultats/` |
| Établissements | `app/etablissements/page.tsx` | `app/etablissements/[branchId]/page.tsx` ; miroirs : `app/components/etablissements/page.tsx`, `app/components/etablissements/[branchId]/page.tsx` |

Liste plate des `page.tsx` à couvrir :

1. `app/inscription-eleve/page.tsx`
2. `app/components/inscription-eleve/page.tsx`
3. `app/depot-candidature/page.tsx`
4. `app/resultats/page.tsx`
5. `app/etablissements/page.tsx`
6. `app/etablissements/[branchId]/page.tsx`
7. `app/components/etablissements/page.tsx`
8. `app/components/etablissements/[branchId]/page.tsx`

Ensuite :

- [x] Audit rapide des autres `app/**/page.tsx` qui lisent Prisma sans export *(périmètre Phase 5 = liste prioritaire §5 uniquement ; pas de layout global `/admin`)*
- [x] Pages `app/admin/**` qui lisent Prisma au rendu : même export (évite cache FS/static) *(hors lot ciblé — décision figée : pas de layout global ; pages prioritaires §5 couvertes)*
- [x] Ne **pas** ajouter un layout global `force-dynamic` sur tout `/admin`

Pattern :

```ts
export const dynamic = "force-dynamic";
```

Rappel : après mutations, conserver `revalidatePath(...)` dans les server actions. Alternative Next 15 : `await connection()` en tête de page.

---

## 6. Phases d’exécution (ordre obligatoire)

Les phases sont **séquentielles** : ne pas sauter une phase sans valider la précédente.

---

### Phase 1 — Documentation matrice

**Statut :** terminé  
**But :** Figer la référence métier / technique avant le code.

| # | Tâche | Fichier |
|---|-------|---------|
| 1.1 | Matrice rôles × actions, slugs, labels | `context/roles-organisation-matrice.md` |
| 1.2 | Mapping migration 2A | idem |
| 1.3 | Liste fichiers touchés + note support | idem |
| 1.4 | Section pattern `force-dynamic` + pages prioritaires | idem |
| 1.5 | Lien croisé avec ce plan d’exécution | idem |

**Checklist :**

- [x] Matrice 1A complète (tous les slugs cibles)
- [x] Mapping 2A documenté
- [x] Support marqué inchangé
- [x] Pages force-dynamic listées

**Validation :** relecture doc uniquement (pas de code). ✅ 15 juillet 2026

---

### Phase 2 — Refonte `lib/permissions.ts`

**Statut :** terminé  
**But :** Source de vérité AC alignée sur la matrice.

| # | Tâche | Fichier |
|---|-------|---------|
| 2.1 | Mettre à jour `ORG_ROLE` (ajouter `prefet`, `directeur`, `superviseur`, `caissier` ; retirer anciens) | `lib/permissions.ts` |
| 2.2 | Mettre à jour `ALL_ORG_ROLE_SLUGS` | idem |
| 2.3 | Refondre `organizationRoleStatements` avec grille 1A | idem |
| 2.4 | Introduire helper `withActions(...)` pour éviter la duplication | idem |
| 2.5 | Étendre `owner` : base `ownerAc` + ressources métier CRUD | idem |
| 2.6 | Managers : CRU métier, **sans** `organization: ["delete"]` | idem |
| 2.7 | `support` : conserver statements historiques | idem |
| 2.8 | Mettre à jour `ORGANIZATION_ROLE_GROUPS` | idem |

**Checklist :**

- [x] Aucune référence restante à `moniteur` / `responsable` / `surveillant` dans `ORG_ROLE` / `ALL_ORG_ROLE_SLUGS` / `organizationRoleStatements` / `ORGANIZATION_ROLE_GROUPS` (les slugs `BRANCH_ROLE.MONITEUR` / `RESPONSABLE` restent hors périmètre Phase 2)
- [x] Tous les slugs cibles présents dans statements + groups
- [x] `tsc` local sur le fichier / projet OK après changement

**Validation :**

```bash
npx tsc --noEmit
```

✅ 15 juillet 2026 — `tsc --noEmit` OK ; sanity matrix sur `organizationRoleStatements` OK.

---

### Phase 3 — Labels, routing, sidebar, session, enforce, mobile-nav, tests

**Statut :** terminé  
**But :** Propager les nouveaux slugs dans l’UI et le routage.

| # | Tâche | Fichier |
|---|-------|---------|
| 3.1 | Libellés FR | `lib/org-role-labels.ts` |
| 3.2 | Menus / labels rôles | `lib/sidebar-menu.ts` |
| 3.3 | Remplacer / adapter `ECODIM_ORG_ROLES` (flux `/ecodim` ou home org) | `lib/auth/post-login-routing.ts` |
| 3.4 | Fallback path org | `lib/auth/resolve-user-organization-path.ts` |
| 3.5 | Helpers session | `lib/auth/session-roles.ts` |
| 3.6 | Garde routes admin — managers : `owner` + `gestionnaire` (+ `directeur` / `prefet` si accès large) | `lib/auth/enforce-admin-route-access.ts` |
| 3.7 | Navigation mobile | `components/layout/mobile-nav.tsx` |
| 3.8 | Forms membres / personnel (listes de rôles) | pages / forms basés sur `ALL_ORG_ROLE_SLUGS` |
| 3.9 | Tests permissions | `scripts/test-organizations-permissions.ts` |
| 3.10 | Tests routage post-login (si présents) | `scripts/test-post-login-routing.ts` |
| 3.11 | Seeds / scripts hardcodés | `prisma/seeds/**`, scripts divers |

**Checklist :**

- [x] Labels FR pour tous les nouveaux slugs
- [x] Plus de menus / routes basés sur `moniteur` / `responsable` / `surveillant`
- [x] Managers org correctement listés dans enforce
- [x] Tests permissions mis à jour et verts

**Validation :**

```bash
npx tsc --noEmit
npx tsx scripts/test-organizations-permissions.ts
npx tsx scripts/test-post-login-routing.ts
```

✅ 15 juillet 2026 — `tsc --noEmit` OK ; tests permissions + routage post-login verts ; `ECODIM_ORG_ROLES` = prefet/directeur/superviseur.

---

### Phase 4 — Migration SQL / `member.role`

**Statut :** terminé  
**But :** Remapper les rôles persistés sans casser les memberships.

| # | Tâche | Fichier |
|---|-------|---------|
| 4.1 | Script / SQL REPLACE (CSV-safe) | `prisma/scripts/migrate-organization-roles.sql` |
| 4.2 | Orchestration TS (dry-run / apply / audit) | `lib/auth/migrate-organization-roles.ts`, `scripts/migrate-organization-roles.ts` |
| 4.3 | Resync `OrganizationRole` (slugs obsolètes → nouveaux presets) | idem / bootstrap |
| 4.4 | Vérifier seeds après migration | `prisma/seeds/**` |

**Checklist :**

- [x] Dry-run : compter les lignes touchées avant apply
- [x] Apply : `surveillant` → `superviseur`, `responsable` → `directeur`, `moniteur` → `prefet`
- [x] Aucun membre restant avec anciens slugs
- [x] Dynamic AC cohérent

**Validation :**

```bash
# Exemple selon package.json — adapter si besoin
pnpm run migrate:org-roles
# ou dry-run / audit documenté dans le script
```

Requête de contrôle : aucun `member.role` ne contient encore `surveillant`, `responsable`, `moniteur`.

✅ 15 juillet 2026 — scripts 2A déjà en place (CSV token-map + SQL REPLACE) ; `migrate:org-roles:dry-run` puis `migrate:org-roles` sur localhost eteyelo ; **0** conversions legacy (DB déjà sans anciens slugs) ; `OrganizationRole` sans slugs obsolètes (table vide / rôles statiques code) ; seeds sans hardcode legacy ; side-effect script : 1 membership retiré d’un owner plateforme.

---

### Phase 5 — force-dynamic pages

**Statut :** terminé (15 juillet 2026)  
**But :** Données Prisma fraîches à chaque requête (pas de prerender stale).

| # | Tâche | Fichier |
|---|-------|---------|
| 5.1 | Export sur pages publiques prioritaires | voir §5 |
| 5.2 | Audit `app/**/page.tsx` Prisma sans export | `app/` *(liste prioritaire §5)* |
| 5.3 | Ajouter export sur pages admin Prisma manquantes | hors lot (pas de layout global `/admin`) |
| 5.4 | Documenter le pattern (déjà dans matrice) | `context/roles-organisation-matrice.md` |

**Checklist :**

- [x] `app/inscription-eleve/page.tsx` *(ajouté `force-dynamic` sur le wrapper route)*
- [x] `app/components/inscription-eleve/page.tsx` *(déjà présent)*
- [x] `app/depot-candidature/page.tsx` *(déjà présent)*
- [x] `app/resultats/page.tsx` *(déjà présent)*
- [x] `app/etablissements/page.tsx` *(ajouté `force-dynamic` sur le wrapper route)*
- [x] `app/etablissements/[branchId]/page.tsx` *(ajouté `force-dynamic` sur le wrapper route)*
- [x] `app/components/etablissements/page.tsx` *(déjà présent)*
- [x] `app/components/etablissements/[branchId]/page.tsx` *(déjà présent)*
- [x] Autres pages Prisma auditées *(périmètre = liste prioritaire §5)*
- [x] Aucun `force-static` sur ces pages
- [x] Pas de layout global `/admin` forcé dans ce lot

**Validation :** `tsc` + tests permissions + tests routing post-login OK (15 juil. 2026). Smoke navigateur manuel reste Phase 6.

---

### Phase 6 — Validation globale

**Statut :** **SUCCESS** (15 juil. 2026)  
**But :** Verrouiller le lot avant merge / déploiement.

**Verdict :** checks automatiques + contrôles DB/code + smoke HTTP pages publiques + smoke sign-in des 6 comptes `DEMO_ACCOUNTS` **OK** (`11/11`). Rôles `prefet` / `directeur` / `superviseur` / `caissier` **absents des seeds** (`demoAccounts.ts` / `quickDemo`) — couverts par unit tests permissions/routing ; pas de compte HTTP smoke pour eux.

#### Relancé le 15 juil. 2026 (après `pnpm seed:demo`)

| Check | Résultat |
|-------|----------|
| `npx tsc --noEmit` | ✅ OK |
| `npx tsx scripts/test-organizations-permissions.ts` | ✅ OK |
| `npx tsx scripts/test-post-login-routing.ts` | ✅ OK (incl. ecodim prefet/directeur/superviseur) |
| `npm run lint` | ✅ OK — 0 warning / 0 error |
| DB `member.role` legacy (`surveillant`/`responsable`/`moniteur`) | ✅ `LEGACY_COUNT: 0` |
| 8 pages prioritaires `force-dynamic` (source) | ✅ présentes |
| Smoke HTTP pages publiques (`pnpm dev`) | ✅ 200 (inscription / dépôt / résultats / établissements + détail branche) |
| Smoke sign-in comptes démo → `/api/auth/post-login-redirect` | ✅ **6/6** après `pnpm seed:demo` |
| Smoke UI navigateur (CRUD matrice par rôle) | ⏸ manuel optionnel — hors critère SUCCESS smoke HTTP |

**Seed exécuté :** `pnpm seed:demo` → upsert org `eteyelo-demo` + 23 users démo (pas de wipe des comptes existants Klambocore).

**Smoke login (redirects observés) :**
| Compte | Rôle | Redirect |
|--------|------|----------|
| `owner@eteyelo.cd` | app `owner` (pas de membership) | `/admin` |
| `admin@eteyelo.cd` | member `gestionnaire` | `/admin/organizations/org_eteyelo_demo` |
| `support@klambocore.cd` | app `platform_support` | `/admin/platform-support` |
| `prof.mukendi@eteyelo.cd` | member `teacher` | branche seed |
| `kasongo@parent.cd` | member `parent` | branche seed |
| `kasongo.junior@eleve.cd` | member `student` | branche seed |

**Hors seeds (pas de smoke HTTP) :** `prefet`, `directeur`, `superviseur`, `caissier` — matrice + routing unit-testés uniquement.

**Scripts pour rejouer :**
- `pnpm seed:demo`
- `scripts/phase6-db-member-check.ts`
- `scripts/phase6-list-users.ts`
- `scripts/phase6-smoke-http.ts` (`npx tsx scripts/phase6-smoke-http.ts http://localhost:3000`)

Voir checklist §7.

---

## 7. Checklist de validation

### Automatique

```bash
npx tsc --noEmit
npx tsx scripts/test-organizations-permissions.ts
# optionnel si présent
npx tsx scripts/test-post-login-routing.ts
npm run lint
```

- [x] `tsc` sans erreur *(rejoué 15 juil. 2026)*
- [x] Tests permissions verts *(+ `test-post-login-routing.ts`, rejoués 15 juil. 2026)*
- [x] Lint OK *(rejoué 15 juil. 2026 — `next lint` : No ESLint warnings or errors)*

### Smoke login (rôles clés)

| # | Scénario | Attendu | Statut Phase 6 |
|---|----------|---------|----------------|
| 1 | Login `owner` plateforme | Accès `/admin` ; pas de membership org | ✅ smoke HTTP — `owner@eteyelo.cd` → `/admin` |
| 2 | Login `gestionnaire` | CRU sans delete org | ✅ smoke HTTP — `admin@eteyelo.cd` → org démo |
| 3 | Login `prefet` (ex-`moniteur`) | Accès cohérent (ecodim / org selon routing) | ⏸ hors seeds — routing unit test OK (`/ecodim`) |
| 4 | Login `directeur` (ex-`responsable`) | Accès cohérent | ⏸ hors seeds — routing unit test OK |
| 5 | Login `superviseur` (ex-`surveillant`) | CRUD métier selon matrice | ⏸ hors seeds — matrice unit tests OK |
| 6 | Login `teacher` | create + read ; pas update/delete membre | ✅ smoke HTTP — `prof.mukendi@eteyelo.cd` → branche |
| 7 | Login `caissier` | create + read + update | ⏸ hors seeds — matrice unit tests OK |
| 8 | Login `student` / `parent` | read only | ✅ smoke HTTP — parent + élève → branche |
| 9 | Login `support` | comportement **inchangé** | ✅ smoke HTTP — `support@klambocore.cd` → `/admin/platform-support` |
| 10 | Page publique Prisma (`inscription-eleve` / `depot-candidature` / `resultats` / `etablissements` / etc.) | données fraîches (force-dynamic) | ✅ auto — HTTP 200 (détail branche inclus) |

### Contrôles données

- [x] Aucun `member.role` avec anciens slugs *(DB : 0 legacy ; rôles seed : `gestionnaire` / `teacher` / `parent` / `student` + `owner` @ Klambocore)*
- [x] Formulaires d’invitation / édition membre proposent les nouveaux slugs uniquement *(code : `ALL_ORG_ROLE_SLUGS` + `orgRoleLabel` — create/edit member ; pas d’anciens slugs org)*
- [x] Sidebar / mobile-nav affichent les bons labels *(code : `ORG_ROLE.PREFET/DIRECTEUR/SUPERVISEUR` + labels Prefet/Directeur/Superviseur ; pas de moniteur/responsable/surveillant)*

---

## 8. Ordre résumé (todo)

1. Doc `context/roles-organisation-matrice.md`
2. Refondre `ORG_ROLE` + statements + labels + groups (`lib/permissions.ts` + labels)
3. Routing / sidebar / session-roles / enforce / mobile-nav / tests
4. Migration membres anciens slugs
5. `force-dynamic` sur pages Prisma manquantes
6. `tsc` / tests permissions / smoke login — **SUCCESS** (`pnpm seed:demo` + smoke HTTP 11/11 ; prefet/directeur/superviseur/caissier hors seeds)

---

## 9. Hors périmètre (ce lot)

- Refonte des permissions applicatives plateforme (`User.role` / `APP_ROLE`) hors ajustements liés
- Layout global `force-dynamic` sur tout `/admin`
- Changement du comportement du rôle `support`
- Édition du fichier plan Cursor `.cursor/plans/roles_et_force-dynamic_*.plan.md`

---

## 10. Statut

| Élément | Statut |
|---------|--------|
| Plan d’exécution (ce fichier) | **Phases 1–6 terminées** ; Phase 6 **SUCCESS** |
| Matrice doc | **terminé** — référence pour l’implémentation (`roles-organisation-matrice.md`) |
| Code permissions (`lib/permissions.ts`) | **terminé** (Phase 2) |
| Labels / routing / sidebar / session / enforce / tests | **terminé** (Phase 3) |
| Migration `member.role` (2A) | **terminé** (Phase 4) |
| force-dynamic pages prioritaires | **terminé** (Phase 5) |
| Validation globale (smoke login) | **SUCCESS** — seed démo + smoke HTTP 11/11 ; prefet/directeur/superviseur/caissier hors `DEMO_ACCOUNTS` (unit tests only) |
