# Plan d'execution - TypeBrache, periodes/examens et ponderation par option

## Objectif

Faire evoluer l'application pour que chaque branche soit configuree selon son type academique des sa creation, puis utiliser ce type partout ou les periodes, examens, bulletins, resultats et ponderations dependent du niveau.

Regles metier a appliquer:

- Branche `PRIMAIRE`: 6 periodes et 3 examens, repartis en 3 trimestres de 2 periodes + 1 examen.
- Branche `SECONDAIRE`: 4 periodes et 2 examens.
- La ponderation d'un cours doit etre definie par option via `CoursOptionPonderation`, pas directement sur `Cours`.
- Toutes les tables et interfaces liees a `Branch` doivent respecter le `TypeBrache` de la branche active.

## Etat actuel observe

- `prisma/schema.prisma` contient deja `enum TypeBrache { PRIMAIRE SECONDAIRE UNIVERSITAIRE }`.
- `Branch.typebranch` existe deja, mais il est optionnel: `typebranch TypeBrache?`.
- La migration `prisma/migrations/20260709133509_typebranche/migration.sql` ajoute seulement la colonne `typebranch`.
- `CoursOptionPonderation` existe deja avec `@@unique([branchId, coursId, optionId])`.
- La migration `20260709125026_cours_unique_and_option_ponderation` supprime `Cours.ponderation`, mais `src/interfaces/Cours.ts` demande encore `ponderation` dans `coursSchema`.
- `prisma/seeds/initPeriod.ts` cree 4 periodes + 2 examens, donc le modele actuel correspond plutot au secondaire.
- Les formulaires de creation/modification de branche ne demandent pas encore le type:
  - `app/admin/organizations/[organizationId]/branches/(no-layout)/schema.ts`
  - `app/admin/organizations/[organizationId]/branches/(no-layout)/branche.action.ts`
  - `app/admin/organizations/[organizationId]/branches/(no-layout)/new/components/create-branch-form.tsx`
  - `app/components/inscription-ecole/branch-create-form.tsx`
  - `app/components/inscription-ecole/ecole.action.ts`
- Plusieurs types de resultats/bulletins sont codes autour de 4 periodes + 2 examens:
  - `lib/types/index.ts`
  - `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/results/page.tsx`
  - `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/results/[id]/page.tsx`
  - composants sous `fiches/components`.

## Phase 1 - Clarifier le modele metier

1. Confirmer les libelles officiels des periodes/examens:
   - Primaire: `1er Periode` a `6e Periode` + `Exam 1er trimestre`, `Exam 2e trimestre`, `Exam 3e trimestre`.
   - Secondaire: `1ere Periode` a `4e Periode` + `Examen 1er semestre`, `Examen 2e semestre`.
2. Confirmer la structure de regroupement:
   - Secondaire: 2 semestres.
   - Primaire: 3 trimestres, chacun avec 2 periodes + 1 examen.
3. Masquer `UNIVERSITAIRE` dans les formulaires tant que ses regles ne sont pas definies.
4. Definir une configuration unique en code, par exemple:
   - `PRIMARY_ACADEMIC_STRUCTURE`
   - `SECONDARY_ACADEMIC_STRUCTURE`
   - helpers: `getAcademicStructure(typebranch)`, `isExamPeriod(period)`, `getPeriodKey(period)`.

## Phase 2 - Base de donnees et Prisma

1. Rendre `Branch.typebranch` obligatoire si aucune branche historique ne doit rester sans type.
2. Prevoir une migration de donnees avant le `NOT NULL`:
   - Mettre les branches existantes sans type en `SECONDAIRE` par defaut, ou demander une correction manuelle.
3. Ajouter des index utiles si les requetes filtrent souvent par type:
   - `@@index([organizationId, typebranch])` sur `Branch`.
4. Verifier les contraintes uniques des tables academiques:
   - `semester`: la contrainte `@@unique([branchId, label])` est bonne.
   - `period`: verifier que la contrainte couvre bien `branchId`, `semesterId`, `label`.
   - `PeriodResultLock`: conserver `@@unique([branchId, periodId])`.
5. Ne pas ajouter `typebranch` sur toutes les tables liees a `Branch` si la relation `branchId -> Branch.typebranch` suffit. Ajouter seulement si besoin historique/versionne.

## Phase 3 - Creation et modification de branche

1. Ajouter `typebranch` dans le schema Zod de creation branche:
   - `createBranchFormSchema`.
   - valeurs autorisees dans l'UI: `PRIMAIRE`, `SECONDAIRE`.
2. Ajouter le champ dans le formulaire admin:
   - `CreateBranchForm`.
   - champ obligatoire avec `Select` ou radio group.
3. Ajouter le champ dans l'inscription publique ecole:
   - `BranchCreateForm`.
   - `CreateBranchInput`.
   - `createBranch`.
4. Ajouter `typebranch` dans:
   - `createBranchAction`.
   - `updateBranchAction`.
   - `getBranchByIdAction`.
5. Afficher le type dans les listes/cartes de branches pour eviter les confusions.
6. Decider si le type est modifiable apres creation:
   - Option recommandee: modifiable uniquement tant qu'aucune periode, fiche, note ou resultat n'existe.
   - Sinon, changement bloque avec message explicite.

## Phase 4 - Initialisation automatique des periodes

1. Creer un service central pour generer les periodes d'une branche selon son type:
   - entree: `branchId`, `typebranch`, `schoolYearId` ou dates d'annee scolaire.
   - sortie: semestres/trimestres + periodes + examens.
2. Appeler ce service apres creation d'une branche, ou lors de la creation de l'annee scolaire courante.
3. Remplacer la logique fixe de `prisma/seeds/initPeriod.ts` par une logique dependante du type.
4. Eviter les doublons:
   - rechercher par `branchId + label + semesterId`.
   - rendre l'operation idempotente.
5. Ajouter une strategie pour les branches existantes:
   - si `SECONDAIRE`: garder 4 periodes + 2 examens.
   - si `PRIMAIRE`: creer les periodes manquantes seulement si aucune donnee contradictoire n'existe.

## Phase 5 - Ponderation par option

1. Retirer les restes de `Cours.ponderation` dans le code:
   - `src/interfaces/Cours.ts`.
   - formulaires cours.
   - colonnes/table cours.
   - pages resultats qui lisent encore `fiche.lesson.cours?.ponderation`.
2. Ajouter une interface de gestion de ponderation par option:
   - selectionner une option.
   - lister les cours.
   - saisir `ponderation` par cours pour cette option.
   - sauvegarder dans `CoursOptionPonderation`.
3. Ajouter des actions serveur:
   - `upsertCoursOptionPonderation`.
   - `getPonderationsByOption`.
   - `deleteCoursOptionPonderation` si besoin.
4. Lors du calcul de maxima, utiliser:
   - `classe.optionId`.
   - `coursId`.
   - `branchId`.
   - recuperer `CoursOptionPonderation.ponderation`.
5. Definir un fallback clair:
   - bloquer la saisie si ponderation manquante.
   - ou afficher un avertissement et utiliser `0`.

## Phase 6 - Notes, fiches, resultats et bulletins

1. Remplacer les types fixes de periodes dans `lib/types/index.ts` par une configuration dynamique basee sur `Branch.typebranch`.
2. Adapter les cles actuellement fixes:
   - `PeriodKey`.
   - `PeriodLabel`.
   - `periodKeyMap`.
   - `SEM_ORDER`.
   - `ApplicationType`.
   - `maximaProfiles`.
3. Adapter les bulletins:
   - primaire: 3 groupes/trimestres avec 6 periodes + 3 examens.
   - secondaire: conserver 2 semestres avec 4 periodes + 2 examens.
4. Adapter `results/page.tsx` et `results/[id]/page.tsx`:
   - ne plus dependre de labels fixes.
   - afficher uniquement les periodes attendues pour la branche active.
   - recuperer les maxima via `CoursOptionPonderation`.
5. Adapter la generation des notes dans `src/server/cron/gradeCron.ts`:
   - conserver le verrou par `branchId + periodId`.
   - tenir compte du type de branche pour savoir quand une periode est complete.
6. Verifier les pages de fiche centrale et fiche de cote:
   - creation de fiche.
   - validation de fiche.
   - calcul des totaux.
   - export PDF.

## Phase 7 - Donnees de test et seeds

1. Mettre a jour les seeds de branche pour inclure `typebranch`.
2. Mettre a jour `initPeriod.ts` pour accepter la branche et son type.
3. Mettre a jour `initCours.ts`:
   - ne plus envoyer `ponderation` dans `Cours`.
   - creer les ponderations dans `CoursOptionPonderation` apres creation des options.
4. Ajouter au moins deux jeux de donnees:
   - une branche primaire.
   - une branche secondaire.
5. Verifier que les seeds restent idempotents.

## Phase 8 - Tests et verification

1. Tests schema/action:
   - creation branche sans `typebranch` refusee.
   - creation branche primaire cree/prepare 6 periodes + 3 examens.
   - creation branche secondaire cree/prepare 4 periodes + 2 examens.
2. Tests ponderation:
   - un meme cours peut avoir des ponderations differentes selon l'option.
   - unicite `branchId + coursId + optionId`.
3. Tests resultats:
   - bulletin primaire affiche 6 periodes + 3 examens.
   - bulletin secondaire affiche 4 periodes + 2 examens.
   - maxima viennent de `CoursOptionPonderation`.
4. Verification manuelle:
   - creer une branche primaire.
   - creer une branche secondaire.
   - creer options/classes/cours.
   - saisir ponderations.
   - saisir/valider fiches.
   - consulter resultats et export bulletin.
5. Commandes a executer seulement pendant l'implementation:
   - `npm run lint`
   - `npx prisma validate`
   - `npx prisma migrate dev`
   - `npx prisma generate`

## Ordre recommande d'implementation

1. Stabiliser le modele `TypeBrache` et rendre le champ obligatoire dans la creation de branche.
2. Centraliser la configuration academique primaire/secondaire.
3. Generer les periodes/examens selon le type de branche.
4. Nettoyer les restes de `Cours.ponderation`.
5. Finaliser la gestion `CoursOptionPonderation` par option.
6. Adapter resultats, fiches et bulletins a la structure dynamique.
7. Mettre a jour seeds et donnees existantes.
8. Tester les deux parcours complets: primaire et secondaire.

## Risques a surveiller

- Les labels de periodes sont utilises comme cles dans plusieurs endroits; les changer sans couche de compatibilite peut casser les resultats existants.
- Rendre `typebranch` obligatoire necessite une migration de donnees pour les branches deja creees.
- Les bulletins semblent fortement structures autour de 2 semestres; le primaire demandera probablement plus qu'un simple ajout de colonnes.
- Les exports PDF peuvent necessiter une mise en page differente pour 12 colonnes academiques.
- Les seeds `dist` peuvent etre obsoletes si le projet les utilise encore.

## Decision avant implementation

Avant de coder, valider ces points:

- Les noms officiels des 6 periodes et 3 examens du primaire.
- Le regroupement primaire: 3 trimestres de 2 periodes + 1 examen.
- Le comportement de `UNIVERSITAIRE`: masque dans l'UI pour cette iteration.
- Le type par defaut des branches existantes.
- Le droit ou non de modifier `typebranch` apres creation.
