# Phase 00 - Resultats de l'audit

Date d'audit : 2026-07-10

## Statut

Phase executee en audit seulement. Aucun comportement applicatif n'a ete modifie.

Fichier source execute : `context/phase-00-audit-garde-fous.md`

## Resume executif

L'application contient deja plusieurs protections utiles : beaucoup d'actions utilisent `requireBranchContext`, plusieurs modules ont `refreshKey`, `router.refresh()` ou `revalidatePath()`, et certaines actions sensibles ont deja une verification de branche.

Les principaux risques identifies sont :

- suppressions physiques encore exposees via des actions `delete...` et des dialogs `Delete...Dialog` ;
- plusieurs actions serveur branche sans `requireBranchContext`, parfois avec contexte custom correct, parfois sans scoping suffisant ;
- formulaires create/update avec `defaultValues: initialData || ...`, donc risque d'inputs uncontrolled/controlled ;
- `teaching.action.ts` principal sans scoping branche visible dans les create/update/delete/list ;
- un `window.location.reload()` restant dans `platform-support-client.tsx` ;
- menus `Sections`, `Options`, `Inscriptions` pas encore adaptes au `typebranch` dans `lib/sidebar-menu.ts`.

## 1. Actions serveur create/update/delete/status/archive

Actions detectees dans les modules branche :

- `classEnrollment.action.ts` : create, delete, update, status.
- `classe.action.ts` : create, update, delete, status.
- `cours.action.ts` : create, update, delete.
- `cours-ponderation-option.action.ts` : create, update.
- `option.action.ts` : create, update, delete, status.
- `creneau.action.ts` : create, update, delete.
- `parent.action.ts` : create, update, delete.
- `personnel.action.ts` : create, update, delete.
- `teacher.action.ts` : create, update, delete.
- `teaching.action.ts` : create, update, delete.
- `ficheCentrales/teaching.action.ts` : create, update, delete.
- `frais.action.ts` : create/update type frais, create/update/status frais.
- `paiement.action.ts` : create paiement, create expense, update, status, delete.
- `section.action.ts` : create, update, delete.
- `schoolYear.action.ts` : create, update, delete.
- `schedule.action.ts` : create, update, delete.
- `student.action.ts` : create, update, delete.
- `CalendarEvent.acton.ts` : create/update/delete event.

Actions organisation / plateforme detectees :

- `branche.action.ts` : create/update branch.
- `members/actions.ts` : create/update organization member/user.
- `support/actions.ts` : create/update/delete organization support agent.
- `partenaires/actions.ts` : create/update/delete partenaire.
- `lib/support/actions.ts` : create/update platform support/escalation.
- `lib/actions.ts` : anciennes actions globales `deleteTeacher`, `deleteStudent`.

## 2. Actions sans `requireBranchContext`

Ces fichiers n'importent pas `requireBranchContext`. Certains utilisent un contexte custom ou une logique organisationnelle legitime ; ils doivent quand meme etre relus avant modification.

### A risque branche

- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/teaching/teaching.action.ts`
  - Risque eleve : create/update/delete/list sans filtre `branchId` visible dans l'audit.
  - `getTeachings()` retourne toutes les affectations.
  - `deleteTeachingAction` supprime par `id` seul.
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/ficheCentrales/teaching.action.ts`
  - A verifier : action liee a l'historique pedagogique.
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/personnel/personnel.action.ts`
  - Utilise probablement un contexte custom ; verifier toutes les suppressions.
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/student/student.action.ts`
  - Utilise `getCurrentBranch()` custom ; acceptable en principe, mais supprimer/archiver doit etre revu.
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/teacher/teacher.action.ts`
  - Utilise `getCurrentBranch()` custom ; acceptable en principe, mais supprimer/archiver doit etre revu.
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/schedule/schedule.action.ts`
  - Utilise `getScheduleContext()` custom avec role et branche ; semble mieux protege que la moyenne.

### Organisation / hors branche a verifier selon contexte

- `app/admin/organizations/[organizationId]/branches/(no-layout)/branche.action.ts`
- `app/admin/organizations/[organizationId]/members/actions.ts`
- `app/admin/organizations/[organizationId]/rapport/rapport.action.ts`
- `app/admin/organizations/[organizationId]/support/actions.ts`
- `app/admin/settings/profile.action.ts`
- `app/components/inscription-ecole/ecole.action.ts`
- `app/contact/actions.ts`
- `app/home.action.ts`
- `lib/support/actions.ts`
- `lib/upload-file.action.ts`

## 3. Suppressions physiques a convertir en archive/desactivation

Suppressions Prisma detectees dans les modules applicatifs :

- `lib/actions.ts`
  - `prisma.teacher.delete`
  - `prisma.student.delete`
- `app/admin/organizations/[organizationId]/support/actions.ts`
  - `prisma.organizationSupportAgent.delete`
  - `organizationSupportBranchScope.deleteMany`
- `app/admin/organizations/[organizationId]/partenaires/actions.ts`
  - `prisma.partnaire.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/cours/cours.action.ts`
  - `prisma.cours.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/classEnrollment/classEnrollment.action.ts`
  - `prisma.classEnrollment.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/parent/parent.action.ts`
  - `prisma.discountRule.deleteMany`
  - `prisma.user.delete`
  - `prisma.parent.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/teaching/teaching.action.ts`
  - `prisma.teaching.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/teacher/teacher.action.ts`
  - `prisma.teacher.delete`
  - `prisma.user.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/classe/classe.action.ts`
  - `prisma.classe.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/CalendarEvent/CalendarEvent.acton.ts`
  - `prisma.calendarEvent.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/schedule/schedule.action.ts`
  - `prisma.schedule.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/personnel/personnel.action.ts`
  - `prisma.personnel.deleteMany`
  - `prisma.user.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/student/student.action.ts`
  - `prisma.student.delete`
  - `prisma.user.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/frais/frais.action.ts`
  - `prisma.frais.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/ficheCentrales/teaching.action.ts`
  - `prisma.teaching.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/creneau/creneau.action.ts`
  - `prisma.creneau.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/option/option.action.ts`
  - `prisma.option.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/section/section.action.ts`
  - `prisma.section.delete`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/schoolYear/schoolYear.action.ts`
  - `prisma.schoolYear.delete`

Notes :

- Les suppressions dans `prisma/seeds/**` et `prisma/seeds/dist/**` sont hors interface standard. Elles restent a manier prudemment mais ne sont pas prioritaires pour l'archivage metier.
- Les suppressions de rollback dans des `catch` apres creation utilisateur doivent etre distinguees des suppressions metier. Elles peuvent rester necessaires pour eviter des utilisateurs orphelins, mais doivent etre documentees.

## 4. Composants `Delete...Dialog` detectes

Dialogs a convertir ou renommer progressivement vers archive/desactivation :

- `classEnrollment/[classeId]/components/delete-Enrollment-dialog.tsx`
- `teaching/[classeId]/components/delete-Teaching-dialog.tsx`
- `classe/components/delete-Classe-dialog.tsx`
- `cours/components/delete-Cours-dialog.tsx`
- `frais/[classeId]/components/delete-Frais-dialog.tsx`
- `creneau/components/delete-Creneau-dialog.tsx`
- `teacher/components/delete-teacher-dialog.tsx`
- `schoolYear/components/delete-SchoolYear-dialog.tsx`
- `ficheCentrales/components/delete-Teaching-dialog.tsx`
- `student/components/delete-students-dialog.tsx`
- `parent/components/delete-parent-dialog.tsx`
- `option/components/delete-Option-dialog.tsx`
- `personnel/components/delete-personal-dialog.tsx`
- `section/components/delete-Section-dialog.tsx`
- `schedule/[classeId]/components/delete-Teaching-dialog.tsx`

## 5. Formulaires avec `defaultValues` a stabiliser

Formulaires utilisant `initialData || ...`, `initialData ?? ...` ou `defaultValues: initialData` :

- `classe/components/classe-form.tsx`
- `creneau/components/creneau-form.tsx`
- `classEnrollment/[classeId]/components/Enrollment-form.tsx`
- `frais/components/type-frais-form.tsx`
- `cours/components/cours-form.tsx`
- `ficheCentrales/components/Teaching-form.tsx`
- `frais/[classeId]/components/frais-form.tsx`
- `option/components/option-form.tsx`
- `teacher/components/teacher-form.tsx`
- `schedule/[classeId]/components/enrollmentUpForm.tsx`
- `personnel/components/personnel-form.tsx`
- `section/components/section-form.tsx`
- `CalendarEvent/component/event.form.tsx`
- `parent/components/parent-form.tsx`

Priorite immediate :

- `creneau/components/creneau-form.tsx`
  - warning React deja observe.
  - champs manquants probables : `startTime`, `endTime`, `durationCourse`, `recreationHour`, `recreationDuration`.
- `teacher/components/teacher-form.tsx`, `personnel/components/personnel-form.tsx`, `parent/components/parent-form.tsx`
  - `defaultValues: initialData` sans fallback visible dans l'audit.

## 6. Refresh incomplet ou a verifier

### Reload navigateur restant

- `app/admin/platform-support/platform-support-client.tsx`
  - contient encore `window.location.reload()`.

### Modules avec refresh deja present mais a harmoniser

- `section`, `option`, `creneau` : `refreshKey` local present.
- `schoolYear` : `refreshKey` et event `school-year-refresh` deja presents.
- `classe`, `teacher`, `student`, `parent`, `personnel`, `paiement` : `refreshKey` present dans les pages ou tables.
- `classEnrollment`, `teaching`, `schedule`, `frais`, `cours` : utilisent `useRefresh()` ou key-based refresh.

### Actions sans revalidation evidente ou a revoir

- `teaching/teaching.action.ts`
  - pas de `revalidatePath()` visible dans l'audit.
  - scoping branche insuffisant.
- `classEnrollment/classEnrollment.action.ts`
  - pas de `revalidatePath()` visible dans l'extrait ; a ajouter pendant phase refresh.
- `student/student.action.ts`, `teacher/teacher.action.ts`, `personnel/personnel.action.ts`
  - contexte custom present pour certains, mais revalidation a verifier dans tout le fichier.

## 7. Routes et menus a adapter au `typebranch`

Fichier principal :

- `lib/sidebar-menu.ts`

Menus actuellement statiques a adapter :

- `Classes > Sections`
- `Classes > Options`
- `Classes > Inscriptions`
- menu futur `Inscription` principal

Regles attendues :

- branche `PRIMAIRE` : masquer `Sections` et `Options`.
- branche `SECONDAIRE` : afficher `Sections` et `Options`.
- `Inscriptions` doit sortir de `Classes` et devenir `Inscription` menu principal.

Autres fichiers lies :

- `components/sidebar.tsx`
- `components/layout/organization-context-nav.tsx`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/client-layout.tsx`
- `classEnrollment/components/CourseSidebar.tsx`

## 8. Modules qui touchent l'historique

Ces modules ne doivent pas perdre de donnees historiques :

- Notes et resultats :
  - `notes/note.action.ts`
  - `notes/FicheSaisieClient.tsx`
  - `fiches/**`
  - `ficheCentrales/**`
  - modeles `StudentGrade`, `fiche`, `period`, `semester`
- Inscriptions :
  - `classEnrollment/**`
  - modele `ClassEnrollment`
- Paiements et frais :
  - `paiement/**`
  - `frais/**`
  - modeles `Frais`, `Invoice`, `PaymentBatch`, `FamilyPayment`, `PaymentAllocation`, `PaymentEvent`
- Presences :
  - `attendance/**`
  - modeles `AttendanceSession`, `StudentAttendance`, `TeacherAttendance`
- Horaire :
  - `schedule/**`
  - modele `Schedule`

## 9. Fichiers a modifier par phase

### Phase 01 - Page principale

- `app/page.tsx`
- nouveau `lib/home/home-data.ts` ou `app/home/home.data.ts`
- composants sous `components/home/`

### Phase 02 - Refresh et formulaires

- pages et tables des modules :
  - `section`
  - `option`
  - `classe`
  - `creneau`
  - `schoolYear`
  - `cours`
  - `coursPonderationOption`
  - `teaching`
  - `schedule`
  - `frais`
  - `paiement`
  - `student`
  - `parent`
  - `classEnrollment`
- actions correspondantes pour `revalidatePath()`.

### Phase 03 - Archivage sans suppression

- `prisma/schema.prisma`
- migrations Prisma a creer
- tous les `delete-*-dialog.tsx`
- actions listées dans la section suppressions physiques
- tables/listes pour filtre actif/archive

### Phase 04 - Vacation et creneau

- `creneau/components/creneau-form.tsx`
- `src/interfaces/creneau.ts`
- `creneau/creneau.action.ts`

### Phase 05 - Annee scolaire autonome

- `schoolYear/schoolYear.action.ts`
- `schoolYear/components/**`
- `branches/(no-layout)/branche.action.ts`
- helper a creer, par exemple `lib/academic-year.ts`

### Phase 06 - Classes primaire et secondaire

- `prisma/schema.prisma`
- `src/interfaces/Classe.ts`
- `classe/classe.action.ts`
- `classe/components/classe-form.tsx`
- `lib/sidebar-menu.ts`
- `option/**`
- `section/**`

### Phase 07 - Capacite et affectation automatique

- `classEnrollment/classEnrollment.action.ts`
- `classe/classe.action.ts`
- helper a creer, par exemple `lib/class-assignment.ts`

### Phase 08 - Inscription unifiee

- nouveau menu/page inscription
- `student/**`
- `parent/**`
- `classEnrollment/**`
- actions serveur inscription a creer
- retrait boutons creation directe dans pages eleve/parent

### Phase 09 - Sidebar, menus et UX

- `lib/sidebar-menu.ts`
- `components/sidebar.tsx`
- `components/layout/organization-context-nav.tsx`
- `client-layout.tsx`
- pages avec boutons principaux

### Phase 10 - Stabilisation finale

- tous les modules touches pendant les phases precedentes.

## 10. Validations executees

Resultats :

```bash
npx tsc --noEmit  # OK
npm run lint      # OK
npm run build     # OK apres relance hors sandbox
```

Note build :

- premiere execution sandbox : echec `spawn EPERM`.
- relance hors sandbox : build complet OK.
- warning non bloquant observe :
  - `bullmq/dist/esm/classes/child-processor.js`
  - `Critical dependency: the request of a dependency is an expression`
  - trace : `src/redis/queues/grade.queue.ts` -> `ficheCentrales/fichecentrale.action.ts`.
