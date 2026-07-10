# Plan de refonte inscription, annee scolaire, refresh et UX

## Objectif

Stabiliser les flux principaux de l'application sans casser l'existant :

- separer la logique serveur lourde de la page publique principale ;
- corriger les problemes de refresh apres create/update/archive/desactivation ;
- corriger l'erreur React uncontrolled/controlled dans les vacations ;
- adapter les classes selon le type de branche `PRIMAIRE` ou `SECONDAIRE` ;
- rendre l'inscription plus autonome avec creation eleve + parent + affectation classe ;
- automatiser l'annee scolaire courante ;
- remplacer les suppressions par archivage/desactivation pour conserver l'historique scolaire ;
- ameliorer l'organisation des menus et quelques points UX.

Ce plan ne doit pas etre execute tout de suite. Il sert de guide d'implementation.

## Diagnostic rapide

### `app/page.tsx`

La page principale contient actuellement beaucoup de logique serveur :

- appels Prisma directs dans `getHomeData()`;
- transformation des donnees ecoles, evenements, partenaires et resultats ;
- logique de fallback et formatage directement dans le fichier de page ;
- UI de landing page dans le meme fichier.

Ce n'est pas interdit dans Next.js, car `app/page.tsx` est un Server Component par defaut et la fonction `HomePage` est `async`. Le probleme vient surtout du melange entre logique data et gros rendu UI. Cela peut compliquer le cache, les refresh, les erreurs Prisma, les tests et la maintenance.

Correction proposee :

- deplacer `getHomeData()` vers `app/home/home.data.ts` ou `lib/home/home-data.ts`;
- garder `app/page.tsx` comme orchestration serveur simple ;
- isoler les sections visuelles dans des composants ;
- ajouter une strategie de cache claire : dynamique si les donnees doivent changer souvent, ou `revalidate` si la landing peut etre mise a jour par intervalle.

### Vacation / creneau

L'erreur :

```txt
A component is changing an uncontrolled input to be controlled
```

vient probablement de `creneau-form.tsx`. Le formulaire initialise seulement :

```ts
defaultValues: initialData || {
  nameCreneau: "",
}
```

mais les champs `startTime`, `endTime`, `durationCourse`, `recreationHour`, `recreationDuration` existent dans le schema et les inputs recoivent ensuite des valeurs definies. React voit donc certains inputs passer de `undefined` a une valeur.

Correction proposee :

- definir tous les champs dans `defaultValues`;
- convertir proprement les nombres avec `Number.isFinite` ou fallback ;
- utiliser `field.value ?? ""` pour les inputs texte/time si necessaire ;
- faire un `form.reset()` propre quand `initialData` change en mode update.

## Phase 1 - Page publique principale

Fichiers principaux :

- `app/page.tsx`
- nouveau fichier `lib/home/home-data.ts` ou `app/home/home.data.ts`
- composants possibles sous `components/home/`

Actions :

1. Extraire les types `HomeSchool`, `HomeEvent`, `HomePartner`, `ResultSlide`, etc.
2. Extraire les fallback data (`schools`, `events`, `partners`, `galleryImages`) dans un fichier separe.
3. Extraire `getHomeData()` dans un module serveur.
4. Gerer les erreurs Prisma avec fallback au lieu de faire tomber toute la page.
5. Decider la strategie de rendu :
   - `export const dynamic = "force-dynamic"` si les donnees doivent etre toujours fraiches ;
   - ou `export const revalidate = 60` / `300` si refresh periodique accepte.
6. Garder `app/page.tsx` lisible : recuperation data + rendu des composants.

Validation :

- `npx tsc --noEmit`
- `npm run lint`
- verifier la page d'accueil avec et sans donnees en base.

## Phase 2 - Refresh des donnees apres action

Probleme vise :

- apres ajout, modification, archivage ou desactivation, certaines tables ne se rafraichissent pas ;
- certains formulaires ne se nettoient pas ;
- certains composants utilisent encore des refresh incomplets ou locaux.

Approche standard a appliquer :

- apres succes server action : `router.refresh()` dans le parent si page server-rendered ;
- si table client fetch ses propres donnees : utiliser `refreshKey` local ;
- fermer le dialog apres succes ;
- reset du formulaire en mode create ;
- vider l'element selectionne apres update/archive/desactivation ;
- utiliser `revalidatePath()` dans les server actions importantes.

Zones a auditer :

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

Actions :

1. Rechercher les actions create/update/archive/status sans `revalidatePath`.
2. Rechercher les pages avec dialog non controle ou table non rafraichie.
3. Normaliser la signature des callbacks :
   - `onSuccess`
   - `onCreated`
   - `onUpdated`
   - `onArchived`
4. Appliquer la meme mecanique dans les menus `Classes`, `Enseignement`, `Finance`, `Utilisateurs`.
5. Verifier qu'il ne reste pas de `window.location.reload()` dans l'administration.

Validation :

- creer, modifier, archiver/desactiver sur chaque module concerne ;
- verifier que la table change sans rechargement complet ;
- verifier que le formulaire se vide apres creation.

## Phase 2 bis - Politique d'archives sans suppression

Regle metier :

- dans une ecole, les donnees doivent rester consultables pour les archives ;
- on ne doit pas supprimer physiquement les eleves, parents, classes, inscriptions, annees scolaires, cours, frais, notes, horaires, presences ou paiements ;
- les boutons `Supprimer` doivent etre retires de l'interface ;
- les actions destructives doivent etre remplacees par `Archiver`, `Desactiver`, `Annuler`, `Cloturer` ou `Masquer` selon le module.

Approche proposee :

- remplacer les suppressions physiques par des champs de statut :
  - `isArchived Boolean @default(false)` si l'objet doit disparaitre des listes actives mais rester consultable ;
  - `archivedAt DateTime?` ;
  - `archivedById String?` si l'audit utilisateur est necessaire ;
  - `status...` existant quand il suffit de desactiver ;
- conserver les anciennes actions `delete...` uniquement si elles sont necessaires pour maintenance technique, non exposees dans l'UI et protegees par permission super-admin ;
- filtrer les listes par defaut pour afficher les elements actifs ;
- ajouter un filtre `Archives` ou `Afficher archives` dans les modules importants ;
- garder les relations intactes pour les bulletins, paiements, inscriptions, presences et historiques.

Modules a traiter en priorite :

- `student`
- `parent`
- `classe`
- `section`
- `option`
- `creneau`
- `schoolYear`
- `cours`
- `teaching`
- `classEnrollment`
- `frais`
- `paiement`
- `notes`
- `schedule`

Actions :

1. Identifier tous les boutons/dialogs `Delete...Dialog`.
2. Remplacer les libelles visibles `Supprimer` par `Archiver` ou `Desactiver` selon le cas.
3. Renommer progressivement les callbacks UI de `onDeleted` vers `onArchived`.
4. Adapter les server actions pour faire un update de statut au lieu d'un `prisma.*.delete`.
5. Ajouter les migrations Prisma necessaires pour les modules qui n'ont pas de champ d'archivage.
6. Adapter les queries pour exclure les archives par defaut.
7. Ajouter des vues/filtres permettant de consulter les archives.

Validation :

- aucune suppression physique depuis l'interface standard ;
- un element archive disparait de la liste active ;
- un element archive reste consultable dans les archives ;
- les bulletins, paiements, inscriptions et historiques continuent de pointer vers les anciennes donnees.

## Phase 3 - Correction vacation / creneau

Fichier principal :

- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/creneau/components/creneau-form.tsx`

Actions :

1. Definir des default values complets :

```ts
const defaultCreneauValues = {
  nameCreneau: "",
  startTime: "",
  endTime: "",
  durationCourse: 45,
  recreationHour: "",
  recreationDuration: 15,
}
```

2. En mode update, normaliser `initialData` pour que chaque champ existe.
3. Sur les champs `number`, eviter `parseInt("")` qui donne `NaN`.
4. Apres create, reset avec les valeurs par defaut completes.
5. Verifier que la recreation reste affichee au milieu avec le design demande precedemment.

Validation :

- ouvrir le formulaire create ;
- ouvrir le formulaire update ;
- modifier les heures ;
- verifier absence de warning console React.

## Phase 4 - Mode primaire sans sections ni options

Regle metier :

- pour une branche `PRIMAIRE`, il n'y a pas de section ni d'option ;
- les classes vont de `1er` a `6e` ;
- chaque niveau peut avoir plusieurs classes : `1er A`, `1er B`, `2e A`, etc.

Impacts schema / data :

- `Classe.optionId` est deja optionnel, donc on peut eviter les options en primaire ;
- il faut ajouter une notion de niveau et de capacite si elle n'existe pas encore.

Champs proposes pour `Classe` :

```prisma
level Int?
parallel String?
capacity Int?
```

Exemples :

- `1er A` : `level = 1`, `parallel = "A"`
- `6e B` : `level = 6`, `parallel = "B"`
- `1er Commerciale` au secondaire peut garder option et nom actuel.

Actions :

1. Ajouter les champs manquants dans Prisma.
2. Adapter `classeSchema`.
3. Adapter `ClasseUpForm` :
   - si branche `PRIMAIRE`, masquer `section` et `option` ;
   - afficher niveau `1` a `6`, parallele et capacite ;
   - generer le nom/code automatiquement si utile.
4. Adapter les queries pour filtrer par `branchId` et `typebranch`.
5. Ne pas supprimer les anciennes options/sections pour secondaire.

Validation :

- branche primaire : creation classe sans option ;
- branche secondaire : comportement actuel conserve.

## Phase 5 - Classes secondaires / humanites

Regle metier :

- secondaire :
  - `7e`
  - `8e`
  - `1er {{option}}`
  - `2e {{option}}`
  - `3e {{option}}`
  - `4e {{option}}`

Actions :

1. Ajouter une logique de generation de classes selon le type de branche.
2. Pour secondaire, garder la liaison optionnelle vers `Option`, mais la rendre obligatoire seulement pour les niveaux `1er` a `4e humanite` si la regle metier le demande.
3. Prevoir une page/action de generation initiale des classes standards par branche.
4. Eviter de recreer les classes chaque annee : elles appartiennent a la branche, pas a l'annee scolaire.

Validation :

- creer les classes une seule fois ;
- utiliser les memes classes pour plusieurs annees scolaires via `ClassEnrollment`.

## Phase 6 - Capacite de classe et affectation automatique

Regle metier :

- pendant l'inscription, si `1er A` est rempli, affecter automatiquement dans `1er B` ;
- si `B` est rempli, passer a `C`, etc. ;
- si aucune classe libre n'existe, proposer de creer la prochaine parallele ou bloquer avec message clair.

Actions cote serveur :

1. Ajouter une fonction :

```ts
findAvailableClassForLevel({
  branchId,
  schoolYearId,
  level,
  typebranch,
  optionId?,
})
```

2. Compter les inscriptions actives par classe et annee scolaire.
3. Trier les classes par parallele `A`, `B`, `C`.
4. Retourner la premiere classe dont `enrolledCount < capacity`.
5. Encadrer l'inscription dans une transaction Prisma pour eviter les doubles affectations si deux inscriptions arrivent en meme temps.

Contrainte a verifier :

- `ClassEnrollment` a deja `@@unique([schoolYearId, studentId])`, ce qui empeche une double inscription du meme eleve dans la meme annee.

Validation :

- remplir artificiellement `1er A` ;
- inscrire un nouvel eleve ;
- verifier affectation en `1er B`.

## Phase 7 - Annee scolaire autonome

Regle metier :

- lors de la creation d'un etablissement, initialiser l'annee scolaire courante ;
- l'annee commence en septembre ;
- elle se termine generalement le 2 juillet ;
- lorsqu'on est a un mois du debut de la prochaine annee, permettre ou preparer sa creation.

Actions :

1. Creer un helper :

```ts
getAcademicYearForDate(date)
```

Exemple :

- date entre septembre 2026 et 2 juillet 2027 => `2026-2027`
- start : `2026-09-01`
- end : `2027-07-02`

2. Lors de `createBranchAction`, creer automatiquement le `SchoolYear` courant.
3. Garantir une seule annee courante par branche :
   - transaction ;
   - mettre les autres `isCurrentYear = false`.
4. Ajouter une action pour creer la prochaine annee scolaire si on est a partir du 1er aout.
5. Dans les modules inscription, frais, enseignement, horaire : utiliser l'annee courante par defaut.

Validation :

- creer une branche en octobre : annee courante creee ;
- creer une branche en juin : annee courante correcte ;
- creer une branche en aout : prochaine annee disponible/preparable.

## Phase 8 - Nouvelle inscription unifiee

Objectif :

L'inscription doit devenir un menu principal, pas seulement un sous-menu de classes. Le flux doit permettre :

- creation ou selection de l'eleve ;
- creation ou selection du parent ;
- choix du niveau/classe cible ;
- affectation automatique dans une classe libre ;
- cas ancien eleve : proposition automatique selon la derniere inscription et le resultat.

Menu :

- retirer `Inscriptions` du sous-menu `Classes`;
- ajouter `Inscription` comme menu principal dans `lib/sidebar-menu.ts`.

UX du flux :

1. Etape eleve :
   - rechercher si l'eleve existe deja ;
   - si nouveau, saisir identite.
2. Etape parent :
   - rechercher parent existant ;
   - si nouveau, creer parent dans le meme flux.
3. Etape parcours :
   - nouveau dans l'ecole : choisir niveau demande ;
   - ancien eleve : proposer affectation automatique.
4. Etape classe :
   - affectation automatique selon capacite ;
   - possibilite de surclasser manuellement avec permission admin.
5. Confirmation :
   - afficher eleve, parent, annee scolaire, classe affectee.

Actions serveur proposees :

```ts
createRegistrationFlowAction()
findParentForRegistrationAction()
findStudentHistoryAction()
suggestNextClassAction()
```

Cas ancien eleve :

- s'il a reussi : proposer classe montante ;
- s'il a echoue : proposer meme niveau ;
- s'il revient apres absence : permettre choix manuel du niveau demande, ex. ancien `2e`, revient deux ans apres pour `5e`.

Donnees a prevoir :

- resultat annuel ou statut de passage ;
- historique des inscriptions ;
- provenance si l'eleve vient d'ailleurs ;
- niveau demande si retour apres absence.

Validation :

- inscrire un nouvel eleve avec parent nouveau ;
- inscrire un nouvel eleve avec parent existant ;
- reinscrire un ancien eleve reussi ;
- reinscrire un ancien eleve echoue ;
- reinscrire un eleve qui revient apres plusieurs annees.

## Phase 9 - Nettoyage des boutons eleve / parent

Demandes :

- enlever le bouton `Ajouter un Tuteur` dans le sous-menu parent ;
- enlever le bouton `Nouvel eleve` dans le sous-menu eleve ;
- centraliser la creation eleve/parent dans le menu `Inscription`.

Actions :

1. Identifier les boutons dans :
   - `parent/page.tsx`
   - `parent/components/*`
   - `student/page.tsx`
   - `student/components/*`
2. Retirer ou masquer les boutons de creation directe.
3. Garder les pages eleve/parent pour consultation, details, modification et archivage/desactivation selon permission.
4. Ajouter un CTA vers le nouveau menu `Inscription` si utile.

Validation :

- menu parent : plus de creation directe ;
- menu eleve : plus de creation directe ;
- inscription : creation eleve/parent disponible.

## Phase 10 - UX application et sidebar

Objectif :

Ameliorer l'ergonomie sans refaire toute l'UI.

Points a traiter :

- emplacement coherent des boutons create/update ;
- fermeture et reset des dialogs ;
- sidebar qui dysfonctionne ;
- menu `Inscription` en entree principale ;
- sous-menus masques selon type de branche :
  - primaire : masquer `Sections` et `Options` ;
  - secondaire : afficher `Sections` et `Options`.

Fichiers probables :

- `components/sidebar.tsx`
- `lib/sidebar-menu.ts`
- `components/layout/organization-context-nav.tsx`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/client-layout.tsx`

Actions :

1. Lire le `typebranch` courant dans le layout ou le contexte branche.
2. Filtrer les menus selon `typebranch`.
3. Corriger l'etat actif de la sidebar.
4. Verifier le comportement mobile/desktop.
5. Normaliser les boutons :
   - bouton principal en haut a droite ;
   - actions de table dans une colonne actions ;
   - dialog ferme apres succes.

Validation :

- primaire : pas section/option dans le menu ;
- secondaire : section/option visibles ;
- navigation active correcte ;
- sidebar stable apres refresh.

## Phase 11 - Ordre d'execution recommande

1. Corriger `creneau-form.tsx` pour supprimer l'erreur console.
2. Stabiliser les refresh create/update/archive/desactivation sur les modules existants.
3. Extraire la logique serveur de `app/page.tsx`.
4. Ajouter autonomie `SchoolYear` a la creation de branche.
5. Ajouter capacite/niveau/parallele aux classes.
6. Adapter classes primaire/secondaire.
7. Creer le nouveau menu et flux `Inscription`.
8. Retirer les boutons directs eleve/parent.
9. Corriger sidebar et filtrage par `typebranch`.
10. Tests complets.

## Tests et validations finales

Commandes :

```bash
npx tsc --noEmit
npm run lint
```

Tests manuels indispensables :

- creation et modification vacation sans warning console ;
- creation branche primaire avec annee scolaire courante automatique ;
- creation branche secondaire avec annee scolaire courante automatique ;
- primaire sans section ni option ;
- secondaire avec section et option ;
- inscription nouvel eleve + nouveau parent ;
- inscription nouvel eleve + parent existant ;
- affectation automatique classe A puis B si capacite atteinte ;
- reinscription ancien eleve reussi ;
- reinscription ancien eleve echoue ;
- retour ancien eleve apres absence de plusieurs annees ;
- refresh des tables apres create/update/archive/desactivation ;
- sidebar correcte sur desktop et mobile.

## Risques

- La capacite de classe demande une transaction solide pour eviter deux affectations simultanees dans une classe pleine.
- Le passage automatique reussi/echoue depend d'une donnee fiable de resultat annuel. Si elle n'existe pas encore, il faudra l'ajouter ou definir une regle a partir des bulletins.
- Masquer `Sections` et `Options` en primaire ne suffit pas : les actions serveur doivent aussi refuser leur usage pour une branche primaire.
- L'automatisation de l'annee scolaire doit respecter les contraintes uniques deja presentes sur `SchoolYear`.

## Livrables attendus apres execution future

- page d'accueil plus maintenable ;
- refresh harmonise dans l'administration ;
- vacation sans warning React ;
- classes adaptees au primaire et au secondaire ;
- inscription centralisee et autonome ;
- affectation automatique selon capacite ;
- annee scolaire courante creee automatiquement ;
- sidebar plus stable et menus adaptes au type de branche.
