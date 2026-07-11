# Phase 10 - Resultats

Date d'execution : 2026-07-11

## Statut

Phase executee.

Fichier source execute : `context/phase-10-stabilisation-finale.md`

## Validations executees

```bash
npx prisma validate  # OK
npx prisma generate  # OK
npx tsc --noEmit     # OK
npm run lint         # OK (2 warnings a11y combobox dans classe-form.tsx)
npm run build        # OK
```

Warning build non bloquant :

- `bullmq/dist/esm/classes/child-processor.js`
- `Critical dependency: the request of a dependency is an expression`

## Corrections de regressions / securite

### Isolation branche

- `switchBranchAction` : verification que la branche appartient a l'organisation active de la session.
- `createBranchAction` / `updateBranchAction` : controle session + role gestionnaire.
- Actions lecture `teaching.action.ts` : filtrage par branche via `requireBranchContext`.
- `ficheCentrales/teaching.action.ts` : re-export du module canonique (suppression du doublon non securise).
- `checkExistingFiche` (notes) : filtre `branchId` obligatoire.
- `getFraisWithBalance` : suppression du contournement par `branchId` fourni par le client.
- `updatePersonnelAction` / `updatePersonnelFullAction` : verification que le personnel appartient a la branche active.
- `getCurrentBranch` (personnel) : delegue a `requireBranchContext`.

### Inscription

- `suggestNextClassAction` et historique eleve : filtre `statusEnrollment: true` pour ignorer les inscriptions archivees.
- `createRegistrationFlowAction` : verification explicite de doublon d'inscription avant creation.
- `createClassEnrollmentAction` : refus des annees scolaires archivees (`isArchived: false`).

### Archives / desactivation

- `archiveTeachingAction` : input simplifie `{ id }` avec verification branche conservee.
- Dialogues de desactivation teaching/schedule/ficheCentrales alignes sur ce contrat.

## Verifications code (audit statique)

### Parcours primaire / secondaire

- Sidebar : `Sections` et `Options` masques pour branches primaires (`lib/sidebar-menu.ts`).
- Guards serveur : `assertSecondaryBranchFeatures` sur section/option.
- Classes : niveaux et options adaptes via `lib/class-structure.ts`.

### Sidebar / routes

- Menus derives du contexte branche (`buildStaticSideLinks`).
- Filtrage par role et type de branche.
- Navigation active corrigee en phase 09 (`components/nav.tsx`).

### Archives

- Pattern soft-delete conserve (`statusX: false`, `buildIsArchivedUpdate`).
- Annee scolaire courante non archivable.
- Classe non archivable si inscriptions actives.

## Tests manuels

Les tests manuels navigateur (creation branche, inscription, sidebar mobile, refresh, etc.) necessitent une session authentifiee et une base de donnees active. Ils n'ont pas ete rejoues automatiquement dans cette session ; le code a ete audite et corrige sur les points critiques identifies.

Checklist a valider en environnement de test :

- [ ] Page d'accueil
- [ ] Creation branche primaire avec annee scolaire automatique
- [ ] Creation branche secondaire avec annee scolaire automatique
- [ ] Creation classe primaire / secondaire
- [ ] Inscription nouvel eleve / ancien eleve
- [ ] Affectation classe pleine
- [ ] Archivage et consultation archive
- [ ] Sidebar desktop/mobile
- [ ] Refresh apres create/update/archive/desactivation

## Decisions metier restantes (non traitees volontairement)

1. **Roles sur mutations secondaires** : parent, personnel (create/archive), classEnrollment, paiement et attendance n'ont pas encore de `canManageOrganization` systematique sur toutes les actions. L'inscription, eleves, enseignants et annees scolaires sont deja proteges.
2. **Doublon email parent global** : l'inscription refuse un email deja utilise dans toute la plateforme, pas seulement dans l'organisation. Comportement metier a confirmer.
3. **Listes incluant archives** : classes, sections et options retournent actives + archivees ; l'UI permet de les consulter. Pas de filtre serveur "actifs uniquement" par defaut.
4. **Legacy `lib/actions.ts`** : `checkExistingFiche` et `archiveTeacher`/`archiveStudent` restent sans filtre branche ; non utilises par l'UI courante mais encore exportes.
5. **Membership branche** : `requireBranchContext` valide org↔branche mais pas l'appartenance explicite du user a la branche (hors `switchBranchAction` desormais contraint a l'org).

## Fichiers modifies

- `app/admin/organizations/[organizationId]/branches/(no-layout)/branche.action.ts`
- `app/admin/organizations/.../teaching/teaching.action.ts`
- `app/admin/organizations/.../ficheCentrales/teaching.action.ts`
- `app/admin/organizations/.../registration/registration.action.ts`
- `app/admin/organizations/.../classEnrollment/classEnrollment.action.ts`
- `app/admin/organizations/.../personnel/personnel.action.ts`
- `app/admin/organizations/.../notes/note.action.ts`
- `app/admin/organizations/.../paiement/paiement.action.ts`
- `app/admin/organizations/.../teaching/[classeId]/components/delete-Teaching-dialog.tsx`
- `app/admin/organizations/.../schedule/[classeId]/components/delete-Teaching-dialog.tsx`

## Definition of Done

- Toutes les validations automatisees passent.
- Regressions critiques d'isolation branche et d'inscription corrigees.
- Decisions metier restantes documentees.
- Tests manuels navigateur a rejouer en environnement de test avec comptes reels.
