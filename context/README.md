# Context - Decoupage testable du plan

Ce dossier decoupe `PLAN_REFONTE_INSCRIPTION_ANNEE_SCOLAIRE_REFRESH_UX.md` en phases d'implementation testables.

Regle de travail :

- executer une seule phase a la fois ;
- ne pas commencer la phase suivante tant que les validations de la phase courante ne sont pas vertes ;
- garder les changements petits, lisibles et reversibles ;
- proteger les donnees scolaires : pas de suppression physique depuis l'interface standard ;
- respecter le `branchId`, le `organizationId`, les roles et le `typebranch` dans toutes les actions serveur ;
- privilegier les server actions transactionnelles pour les operations metier sensibles.

## Ordre recommande

1. [Phase 00 - Audit et garde-fous](./phase-00-audit-garde-fous.md)
2. [Phase 01 - Page publique principale](./phase-01-page-principale.md)
3. [Phase 02 - Refresh et formulaires](./phase-02-refresh-formulaires.md)
4. [Phase 03 - Archivage sans suppression](./phase-03-archivage-sans-suppression.md)
5. [Phase 04 - Vacation et creneau](./phase-04-vacation-creneau.md)
6. [Phase 05 - Annee scolaire autonome](./phase-05-annee-scolaire-autonome.md)
7. [Phase 06 - Classes primaire et secondaire](./phase-06-classes-primaire-secondaire.md)
8. [Phase 07 - Capacite et affectation automatique](./phase-07-capacite-affectation.md)
9. [Phase 08 - Inscription unifiee](./phase-08-inscription-unifiee.md)
10. [Phase 09 - Sidebar, menus et UX](./phase-09-sidebar-menus-ux.md)
11. [Phase 10 - Stabilisation finale](./phase-10-stabilisation-finale.md)
12. [Plan organisations et permissions](./plan-gestion-organisations-permissions.md)
13. [Phase 01 - Organisations et permissions (resultat)](./phase-01-organisations-permissions.md)
14. [Phase 02 - Garde-fous serveur organisations (resultat)](./phase-02-organisations-garde-fous.md)
15. [Phase 03 - UI organisations CRUD (resultat)](./phase-03-organisations-crud-ui.md)
16. [Phase 04 - Permissions membres Better Auth (resultat)](./phase-04-organisations-permissions-membres.md)
17. [Phase 05 - Navigation coherente par role (resultat)](./phase-05-organisations-navigation.md)
18. [Phase 06 - Seeds et comptes demo (resultat)](./phase-06-organisations-seeds.md)
19. [Phase 07 - Migration donnees existantes (resultat)](./phase-07-organisations-migration-donnees.md)
20. [Phase 08 - Tests et documentation roles (resultat)](./phase-08-organisations-tests.md)
21. [Flux des roles organisations](./organisations-roles-flow.md)

## Validation minimale a chaque phase

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Pour les phases qui touchent Prisma :

```bash
npx prisma validate
npx prisma generate
```

Si une migration est ajoutee, verifier explicitement la migration avant de continuer.

## Definition of Done commune

- TypeScript passe.
- Lint passe.
- Build passe.
- Les actions serveur verifient le contexte branche/organisation.
- Les formulaires ne gardent pas d'etat sale apres succes.
- Les tables se rafraichissent sans reload complet.
- Les erreurs utilisateur sont comprehensibles.
- Aucun bouton de suppression physique n'est expose dans l'interface standard.
