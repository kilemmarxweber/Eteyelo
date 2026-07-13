# Context 2 - Plan de correction, amelioration et design

## 1. Objectif et regles de mise en oeuvre

Ce document est uniquement un plan. Aucune fonctionnalite decrite ci-dessous ne doit etre implementee avant validation du plan.

Principes communs a toutes les phases :

1. Utiliser prioritairement les composants shadcn/ui deja presents (`Button`, `Card`, `Dialog`, `Drawer`, `Sheet`, `Form`, `Input`, `Select`, `Tabs`, `Badge`, `Table`, `Popover`, `Calendar`, `Skeleton`, `AlertDialog`, etc.).
2. Respecter le design system Eteyelo, le responsive mobile/tablette/desktop, le mode sombre, l'accessibilite clavier et les etats loading/empty/error/success.
3. Garder toutes les donnees strictement isolees par `organizationId` et `branchId`, et par annee scolaire lorsque cela s'applique.
4. Conserver les autorisations existantes et verifier les permissions dans les Server Actions, pas seulement dans l'interface.
5. Eviter les suppressions physiques pour les donnees metier : utiliser des statuts, l'archivage et une trace d'audit.
6. Valider les formulaires avec Zod et React Hook Form, afficher l'erreur sous le champ concerne et ne fermer un dialogue qu'apres une reponse serveur reussie.
7. Pour les PDF, centraliser l'entete de rapport (logo, nom de branche, organisation, date/periode, pagination) afin d'avoir une presentation identique partout.

## 2. Ordre d'execution recommande

1. Audit transversal des dialogues, formulaires, permissions et donnees de branche.
2. Modele de demande d'inscription et notifications.
3. Photo/camera et formulaire public avec parents.
4. Confirmation d'une demande et pre-remplissage de l'inscription administrative.
5. Correction et standardisation des dialogues.
6. Tableaux de bord enseignants et personnel.
7. Parametres, calendrier et presences.
8. Ponderation des cours et affectation.
9. Rapports PDF des eleves.
10. Rapport de caisse et graphiques.
11. Impression des horaires par classe.
12. Stabilisation, tests et controle visuel final.

Cet ordre evite de construire l'interface de notification avant son modele de donnees et permet de reutiliser les composants de rapport et de dialogue dans les phases suivantes.

## 3. Phase 0 - Audit technique et garde-fous

Fichiers et zones a examiner :

- `prisma/schema.prisma` et les migrations existantes ;
- `components/layout/admin-top-bar.tsx` et le layout de branche ;
- `components/ui/dialog.tsx`, `components/ui/responsive-dialog.tsx` et tous les dialogues de formulaires ;
- les Server Actions des pages concernees ;
- les composants PDF existants et les informations disponibles sur `Branch`/`Organization` ;
- les roles capables de consulter et confirmer une demande d'inscription.

Actions planifiees :

1. Inventorier les dialogues qui utilisent un bouton implicite `type="submit"`, `DialogClose`, un `onOpenChange` trop agressif ou une fermeture dans un `finally`.
2. Verifier les types de branche, les annees scolaires courantes, les classes et les inscriptions actives.
3. Identifier la source officielle du logo : logo de branche en priorite, puis logo d'organisation, puis logo Eteyelo en fallback.
4. Fixer les regles d'acces : administrateur/gestionnaire pour confirmer une demande, lecture seule selon les permissions, enseignant sans acces aux informations sensibles sauf autorisation explicite.
5. Definir les limites des images (formats JPEG/PNG/WebP, taille maximale, compression, orientation et stockage).
6. Relever les temps de chargement des pages affectation, enseignants, personnel et rapports avant modification.

Critere de validation : une courte fiche d'audit liste les composants a corriger, les permissions retenues et les sources de donnees, sans mutation de la base.

## 4. Phase 1 - Modele de demande d'inscription et journal de traitement

Le mot « log » doit ici representer une vraie demande metier exploitable, et non un simple texte JSON impossible a filtrer. Nom recommande : `RegistrationRequest` (ou `RegistrationRequestLog` si le nom `Log` est obligatoire).

Modele propose :

1. Identifiants et contexte : `id`, `organizationId`, `branchId`, `schoolYearId?`, numero/reference unique.
2. Statut enumere : `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `REGISTERED`, `ARCHIVED`.
3. Donnees eleve soumises : nom, postnom, prenom, sexe, date et lieu de naissance, adresse, telephone/email si necessaire, provenance, classe/niveau/option souhaites, observation et photo facultative.
4. Donnees du ou des responsables : responsable principal obligatoire selon les regles metier, second responsable facultatif, lien de parente, telephone, email, adresse et personne a contacter en urgence.
5. Traitement : `confirmedById?`, `confirmedAt?`, `registeredById?`, `registeredAt?`, `rejectedReason?`, `studentId?`, timestamps.
6. Audit : conserver le contenu soumis ou un snapshot versionne afin qu'une modification ulterieure du formulaire ne rende pas les anciennes demandes illisibles.
7. Index : `[branchId, status, createdAt]`, reference unique, et index sur telephone/nom pour detecter les doublons.

Relations a ajouter sans casser l'existant :

- relation vers `Branch`, l'annee scolaire eventuelle, l'utilisateur qui traite et l'eleve cree ;
- si plusieurs parents doivent finalement etre rattaches a un eleve, planifier une table de liaison `StudentGuardian` avec `isPrimary`, `relationship` et `canPickup`, plutot que de dupliquer des parents ;
- conserver temporairement `Student.parentId` pour compatibilite, puis migrer progressivement si le besoin multi-responsables est confirme.

Actions serveur planifiees :

1. Creer une demande publique avec validation, normalisation et protection anti-spam.
2. Lister les demandes de la branche avec pagination et filtre de statut.
3. Compter les demandes non lues/en attente pour le badge.
4. Confirmer, rejeter ou archiver avec transaction Prisma et controle d'autorisation.
5. Marquer la demande `REGISTERED` seulement apres reussite complete de l'inscription administrative.

Critere de validation : une demande publique est stockee une seule fois, reste rattachee a la bonne branche et son historique de traitement est consultable.

## 5. Phase 2 - Notification dans l'en-tete

Le composant `components/layout/admin-top-bar.tsx` contient deja une cloche inactive. Dans le layout de branche, la cloche sera placee a droite, a cote du bouton de theme, avec la meme hauteur et les memes zones tactiles.

Actions planifiees :

1. Transformer la cloche en `Popover` ou `Sheet` shadcn responsive : popover sur bureau, feuille/drawer sur mobile.
2. Afficher un badge discret avec le nombre de demandes `PENDING`; masquer le badge lorsque le total vaut zero.
3. Afficher dans la liste : photo miniature, nom complet, classe/niveau souhaite, responsable principal, date relative et statut.
4. Ajouter les etats skeleton, liste vide, erreur/reessayer et pagination ou « Voir toutes ».
5. Ajouter une page complete des demandes si le volume depasse ce qu'un popover peut contenir.
6. Ajouter les actions `Examiner`, `Confirmer`, `Rejeter` selon les permissions.
7. Mettre a jour le compteur apres une action via `router.refresh()`, invalidation de cache ou actualisation ciblee; un polling modere peut etre utilise au debut, le temps reel n'etant pas indispensable pour la V1.
8. Rendre l'icone accessible : libelle, focus visible, navigation clavier et annonce du nombre de demandes.

Nettoyage attendu : apres inscription reussie, la demande ne figure plus parmi les notifications actives; elle reste dans l'historique avec le statut `REGISTERED`.

## 6. Phase 3 - Photo facultative par fichier ou camera

Pages concernees :

- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/registration/` ;
- `app/inscription-eleve/` et son composant reel sous `app/components/inscription-eleve/`.

Composant partage propose : `StudentPhotoField`.

Actions planifiees :

1. Ajouter une zone shadcn avec avatar/aperçu et deux actions : `Parcourir une image` et `Prendre une photo`.
2. Utiliser un input fichier avec `accept="image/jpeg,image/png,image/webp"` et `capture="user"` sur mobile lorsque possible.
3. Pour une vraie previsualisation camera sur appareil compatible, utiliser `navigator.mediaDevices.getUserMedia`, avec consentement explicite, bouton capturer/reprendre et arret obligatoire du flux a la fermeture/demontage.
4. Prevoir le fallback fichier si la camera est refusee, indisponible ou si le navigateur n'est pas compatible.
5. Afficher apercu, remplacement et suppression avant envoi.
6. Compresser/redimensionner raisonnablement l'image avant upload; revalider le MIME et la taille cote serveur.
7. Stocker uniquement une URL/cle de fichier dans la base (`User.image` peut etre reutilise apres creation); ne pas stocker un gros base64 dans Prisma.
8. Laisser la photo totalement facultative et afficher un avatar avec initiales lorsqu'elle manque.

Critere de validation : l'inscription fonctionne avec ou sans photo, sur mobile et ordinateur, et aucun flux camera ne reste actif apres fermeture.

## 7. Phase 4 - Amelioration de l'inscription publique et ajout des parents

Actions planifiees pour `app/inscription-eleve/` :

1. Transformer le formulaire en parcours lisible par etapes : Etablissement, Eleve, Responsable(s), Scolarite souhaitee, Verification.
2. Ajouter un indicateur de progression, sauvegarde locale temporaire non sensible, retour a l'etape precedente et resume avant soumission.
3. Ajouter un responsable principal : nom, postnom, prenom, lien avec l'eleve, telephone, email facultatif, adresse et profession facultative.
4. Permettre un second responsable facultatif avec bouton `Ajouter un autre parent/responsable`.
5. Ajouter une option « meme adresse que l'eleve » pour eviter la ressaisie.
6. Normaliser les numeros congolais et empecher les doublons evidents sans reveler les donnees d'autres familles.
7. Ajouter les champs photo/camera de la phase precedente.
8. Clarifier que l'envoi est une demande a confirmer, pas encore une inscription definitive.
9. Apres soumission, afficher une reference, le statut `En attente` et les prochaines etapes; ne jamais creer directement les comptes, parents, eleves ou affectations depuis le formulaire public.
10. Ajouter consentement pour le traitement des donnees et protection anti-double clic/anti-spam.

Critere de validation : une famille peut envoyer une demande complete avec un ou deux responsables, recevoir une reference et ne produit aucune inscription partielle.

## 8. Phase 5 - Confirmation et pre-remplissage de l'inscription administrative

Flux cible :

1. Le gestionnaire ouvre une notification et consulte une fiche detaillee dans un grand dialogue responsive.
2. Il controle les doublons potentiels d'eleve et de parent par nom, date de naissance, telephone et email.
3. Le bouton `Confirmer et continuer` ne cree pas encore aveuglement toutes les entites : il ouvre `registration` avec un `requestId` signe/autorise.
4. La page administrative charge la demande cote serveur et pre-remplit l'eleve, la photo, le responsable principal, le second responsable eventuel et la scolarite souhaitee.
5. Le gestionnaire peut corriger les donnees, rattacher un parent existant et choisir la classe exacte.
6. La finalisation execute une transaction unique : utilisateur(s), parent(s), eleve, inscription de classe, rattachements, puis statut `REGISTERED` de la demande.
7. En cas d'echec, la transaction est annulee et la notification reste active avec un message exploitable.
8. En cas de succes, nettoyer le formulaire, fermer le dialogue, rafraichir les listes et retirer la demande du badge actif.
9. Interdire la double confirmation avec controle du statut et idempotence cote serveur.

Critere de validation : aucune inscription partielle ni double inscription n'est creee, et l'origine de l'inscription reste tracable.

## 9. Phase 6 - Correction et dimensionnement des dialogues

Probleme a corriger : un dialogue ne doit pas se fermer lorsqu'un champ `Select` requis n'a pas de valeur ou lorsque la validation echoue.

Actions planifiees :

1. Standardiser tous les formulaires avec `form.handleSubmit(onValid, onInvalid)` et schema Zod complet.
2. Mettre `type="button"` sur tous les boutons qui ne soumettent pas le formulaire.
3. Retirer `DialogClose` autour du bouton de validation; le conserver uniquement sur `Annuler`/fermeture explicite.
4. Fermer avec `setOpen(false)` uniquement apres succes confirme de la Server Action.
5. Ne jamais fermer dans `finally`; conserver les valeurs et erreurs apres echec.
6. Empecher la fermeture accidentelle pendant une soumission (`loading`) et avertir avant de perdre un formulaire modifie si necessaire.
7. Verifier que les contenus `Select`/`Popover` ne declenchent pas une fermeture par propagation ou mauvais nesting.
8. Faire evoluer `ResponsiveDialogContent` avec des variantes de taille : `sm`, `md`, `lg`, `xl`, `full`, sans forcer tous les dialogues a etre grands.
9. Dimension recommande : petits confirmateurs en `sm`, formulaires standards en `lg`, formulaires riches/donnees nombreuses en `xl` ou `min(96vw, 1200px)`; hauteur maximale `90-94vh`, entete et pied fixes, corps scrollable.
10. Sur mobile, utiliser `Drawer` plein ou presque plein ecran avec boutons accessibles au pouce.

Critere de validation : soumettre sans selection affiche l'erreur et garde le dialogue ouvert; les grands formulaires utilisent efficacement l'ecran sans depassement.

## 10. Phase 7 - Tableau de bord des enseignants

Page : `teacher/`, en reprenant les bonnes conventions visuelles de `student/` sans copier des donnees inutiles.

Cartes proposees :

1. Total enseignants actifs.
2. Enseignants affectes a au moins une classe/cours.
3. Enseignants non affectes.
4. Total d'affectations cours-classe.
5. Charge moyenne de cours/classes par enseignant.
6. Enseignants avec horaire incomplet ou conflit, si la donnee est fiable.

Ameliorations UX :

1. Cartes cliquables appliquant le filtre correspondant a la table.
2. Filtres `Tous`, `Affectes`, `Non affectes`, classe, cours et statut.
3. Afficher dans la ligne/carte les classes, cours, nombre d'affectations et prochain cours lorsque disponible.
4. Ajouter un appel a l'action `Affecter` sur les enseignants non affectes, selon permission.
5. Calculer les agrégats cote base (`count`, `groupBy`) plutot que de charger toutes les relations dans le navigateur.
6. Ajouter skeleton, etat vide contextuel et responsive table/cartes.

Critere de validation : les totaux correspondent aux filtres et une affectation mise a jour rafraichit les cartes sans rechargement complet inutile.

## 11. Phase 8 - Tableau de bord du personnel

Page : `personnel/`.

Cartes proposees :

1. Total du personnel actif.
2. Personnel avec role/fonction affecte.
3. Personnel sans role/fonction.
4. Repartition par role.
5. Presence du jour : presents, absents, retards, lorsque les donnees de presence existent.

Ameliorations UX :

1. Filtres par statut, role et presence.
2. Cartes cliquables et table synchronisee.
3. Action rapide `Attribuer un role` pour les personnes sans fonction.
4. Ne pas assimiler « personnel affecte » a une classe : pour le personnel, l'affectation pertinente est le role/fonction ou le service.
5. Afficher les tendances de presence uniquement si la periode contient assez de donnees; sinon montrer un etat informatif.

Critere de validation : les indicateurs reposent sur des definitions metier visibles et les totaux restent coherents avec la table filtree.

## 12. Phase 9 - Ajouter Calendrier et Presences dans Parametres

Zone : `settings/` de la branche.

Actions planifiees :

1. Ajouter dans la navigation des parametres deux entrees : `Calendrier scolaire` vers `CalendarEvent/` et `Presences` vers `attendance/`, ou creer des sous-pages de configuration distinctes si les pages actuelles sont des pages d'exploitation.
2. Eviter la confusion entre configuration et utilisation quotidienne :
   - Parametres calendrier : types, couleurs, recurrence, jours feries, visibilite ;
   - Parametres presence : rayon/geolocalisation, statuts, horaires, tolerances et permissions ;
   - boutons explicites vers les tableaux de bord operationnels.
3. Corriger les libelles, icones, routes actives et droits d'acces dans la sidebar des parametres.

Critere de validation : les deux domaines sont accessibles depuis Parametres sans dupliquer la logique ni exposer une page a un role non autorise.

## 13. Phase 10 - Formulaire et rapport de calendrier

dans la Zone : `settings/` de la branche.

Page : `CalendarEvent/`.

Ameliorations du formulaire :

1. React Hook Form + Zod pour titre, description, type, debut/fin, journee entiere, recurrence, couleur et visibilite.
2. Date et heure via composants shadcn, validation `fin >= debut` et champs conditionnels pour la recurrence.
3. Apercu du resultat, aide sur la recurrence et confirmation avant modification d'une serie.
4. Formulaire dans un dialogue `lg/xl` ou une feuille laterale selon la densite.
5. Apres sauvegarde, refresh cible et conservation du formulaire si erreur.

Tableau de bord/rapport :

1. Cartes : evenements du mois, a venir, passes, par type.
2. Vues liste/calendrier, filtres par periode/type/statut.
3. Export PDF d'une periode avec entete de branche, regroupement par date et pagination.

## 14. Phase 11 - Formulaires et tableau de bord des presences

Page : `attendance/` et dans la Zone : `settings/` de la branche.

Ameliorations des formulaires :

1. Unifier les statuts et leurs couleurs avec `Badge`.
2. Ajouter recherche, selection rapide, `Tout present`, modification individuelle et remarque/justification conditionnelle.
3. Barre d'action fixe, sauvegarde par lot, retour visuel par ligne et protection contre les doubles envois.
4. Clarifier session, classe/cours, date, heure et personne responsable avant saisie.
5. Dialogues larges pour les listes, tables compactes et drawer mobile.

Tableau de bord/rapport :

1. Filtres par periode, type de personne, classe, enseignant et statut.
2. Cartes : taux de presence, absences, retards, non renseignes et evolution par rapport a la periode precedente.
3. Graphique temporel et repartition par statut; aucun graphique trompeur si la periode n'a pas assez de donnees.
4. Tableau des absences recurrentes et classement des classes par taux, avec seuils explicites.
5. Export PDF/CSV de la vue filtree avec logo, branche, periode, filtres et totaux.

Critere de validation : les cartes, graphiques, table et exports utilisent exactement le meme jeu de filtres.

## 15. Phase 12 - Design de la ponderation des cours

Page : `coursPonderationOption/`.

Actions planifiees :

1. Ajouter un `PageHeader` clair avec annee scolaire, option/section active et action principale.
2. Organiser la page en selection de contexte puis matrice/table de ponderations.
3. Afficher cours, option/classe, ponderation actuelle, statut et derniere mise a jour.
4. Ajouter recherche, filtres, tri, edition inline ou panneau lateral et sauvegarde optimiste avec rollback en cas d'erreur.
5. Valider les bornes et doublons, mettre en evidence les ponderations manquantes/incoherentes.
6. Ajouter resume : nombre de cours configures, manquants, moyenne/somme pertinente selon la regle metier.
7. Ajouter skeleton, etat vide avec action et version mobile en cartes.

Critere de validation : l'utilisateur comprend d'abord le contexte actif, peut reperer les valeurs manquantes et modifier sans perdre sa position.

## 16. Phase 13 - Menu Affectation : design et rapidite

Zone cible : pages `teaching/` et affectations cours-classe-enseignant.

Actions planifiees :

1. Remplacer le parcours page par page par une vue maitre/detail : classes a gauche, affectations de la classe a droite.
2. Ajouter recherche et filtres pour classe, enseignant, cours et etat affecte/non affecte.
3. Permettre l'affectation rapide par ligne et les affectations par lot lorsque les regles le permettent.
4. Charger seulement les donnees du contexte visible, paginer les grandes listes et eviter les requetes N+1.
5. Recuperer en parallele les enseignants/cours/classes necessaires et mettre en cache les listes stables.
6. Utiliser mise a jour optimiste, desactiver uniquement la ligne en cours et restaurer l'etat en cas d'echec.
7. Detecter avant envoi les doublons, incompatibilites et conflits d'horaire connus.
8. Afficher un compteur des cours sans enseignant et un raccourci vers ceux-ci.
9. Ajouter toast de succes avec action `Annuler` uniquement si une operation inverse sure est disponible.

Critere de validation : une affectation simple ne demande pas de recharger toute la page et le resultat apparait immediatement dans les compteurs enseignants.

## 17. Phase 14 - Rapport PDF des eleves

Page : `student/`, composant existant `components/export-students-pdf.ts`.

Entete partagee :

1. Logo de branche, ou fallback organisation/Eteyelo.
2. Nom de la branche et de l'organisation.
3. Titre dynamique, date de generation, annee scolaire et filtres appliques.
4. Pagination `Page X / Y` et pied de page stable.

Rapport global sans filtre de classe :

1. Titre : `Liste globale de tous les eleves`.
2. Colonnes : numero/matricule, nom, postnom, prenom, sexe, lieu de naissance, date de naissance, age calcule a la date de generation et classe actuelle.
3. Afficher `Non affecte` lorsque l'eleve n'a pas de classe active.
4. Orientation paysage, largeurs controlees et repetition de l'entete du tableau sur chaque page.

Rapport avec classe filtree :

1. Titre : `Liste des eleves de la classe {nomClasse}`.
2. Ne pas afficher l'age, la date de naissance, le lieu de naissance ni une colonne classe.
3. Colonnes recommandees : numero/matricule, nom, postnom, prenom, sexe; toute autre information doit etre justifiee par le besoin scolaire.
4. Le nom de classe apparait dans le titre uniquement.

Actions techniques :

1. Passer au generateur PDF un objet de contexte explicite (`branch`, `organization`, `schoolYear`, `selectedClass`, `filters`) au lieu de seulement `students`.
2. Utiliser l'inscription active de l'annee scolaire selectionnee, pas une ancienne classe arbitraire.
3. Charger et convertir le logo de maniere sure; fallback textuel si l'image est absente/invalide.
4. Tester les accents, noms longs, listes vides et rapports multi-pages.

Critere de validation : colonnes et titre changent exactement selon la presence du filtre classe et chaque page est identifiable par la branche.

## 18. Phase 15 - Rapport de caisse et PDF de paiement

Page : `paiement/`. Les composants `CashierReport` et `CashierExpenseForm` ainsi que le modele `CashierExpense` existent deja : ils doivent etre consolides plutot que dupliques.

Filtres proposes :

1. Periode : journalier, intervalle personnalise, hebdomadaire, mensuel.
2. Date de debut/fin, annee scolaire, mode de paiement, type de frais, classe et caissier si disponible.
3. Bouton appliquer et resume visible des filtres actifs.

Indicateurs :

1. Solde d'ouverture si disponible ou clairement marque non gere.
2. Total encaissements.
3. Total depenses.
4. Solde net restant = encaissements - depenses, avec regle explicite.
5. Nombre de transactions, montant moyen et ventilation par mode/type.

Presentation :

1. Pour une seule journee, produire un rapport tabulaire sans graphique, comme demande.
2. Pour plusieurs jours, proposer un commutateur `Inclure les graphiques`; ne generer le graphique que si selectionne.
3. Graphiques possibles : encaissements/depenses/solde par jour et repartition des encaissements; limiter leur nombre pour garder le PDF lisible.
4. Deux tableaux detailles : encaissements puis depenses, avec reference, date, libelle, personne/categorie et montant.
5. Totaux et solde en fin de rapport, avec entete logo/branche/periode et pagination.
6. Generer le PDF a partir du meme resultat serveur que les cartes et tableaux afin d'eviter des ecarts.
7. Nom de fichier explicite : `rapport-caisse-{branche}-{debut}-{fin}.pdf`.

Integrite :

1. Toutes les sommes sont calculees cote serveur avec `Decimal`, puis formatees en devise.
2. Les depenses archivees/annulees sont exclues ou montrees separement selon la regle choisie.
3. Le rapport indique sa devise et son fuseau horaire.

Critere de validation : `solde net = encaissements - depenses` pour la meme periode et les memes filtres, dans l'ecran comme dans le PDF.

## 19. Phase 16 - Rapport PDF des horaires par classe

Page : `schedule/[classeId]/` et tableau d'horaire existant.

Actions planifiees :

1. Ajouter un bouton `Imprimer l'horaire de la classe` au-dessus du tableau, visible lorsque la classe contient des horaires.
2. Generer une grille jours x creneaux, avec cours, enseignant et salle si cette donnee existe.
3. Afficher clairement la recreation et les cellules sans cours.
4. Entete : logo, organisation, branche, nom de classe, annee scolaire et vacation/creneau.
5. Pied : date d'impression et pagination si necessaire.
6. Utiliser une version print CSS pour l'impression rapide et un PDF telechargeable pour l'archivage.
7. Reutiliser le composant commun d'entete PDF de la phase 14.
8. Bloquer ou signaler les conflits avant impression; ne pas masquer silencieusement deux cours au meme moment.

Critere de validation : le PDF correspond exactement au tableau visible et tient lisiblement sur une page A4 paysage dans le cas normal.

## 20. Phase 17 - Tests, performance et recette finale

Tests fonctionnels prioritaires :

1. Demande publique avec zero, une et deux photos tentatives; camera acceptee/refusee/indisponible.
2. Demande avec un puis deux responsables.
3. Badge notification a zero, une et plusieurs demandes.
4. Confirmation, rejet, double clic, erreur serveur et reprise d'une demande.
5. Pre-remplissage puis inscription reussie; verification que la notification disparait mais que l'historique reste.
6. Tous les formulaires avec `Select` requis vide : dialogue toujours ouvert et erreur visible.
7. Dialogues desktop et drawers mobile, clavier et lecteur d'ecran.
8. Totaux enseignants/personnel avant et apres affectation.
9. Calendrier et presences avec filtres identiques entre dashboard et export.
10. PDF eleves global et par classe, logo absent/present, noms longs et plusieurs pages.
11. Rapport caisse journalier sans graphique et periode longue avec/sans graphique.
12. Horaire vide, complet, avec recreation et avec conflit.

Verification technique :

1. Migration Prisma revue avant application et sauvegarde de base planifiee.
2. `prisma validate` et generation du client.
3. TypeScript, lint et tests automatises du projet.
4. Tests des Server Actions pour isolation `branchId`, permissions, idempotence et calculs financiers.
5. Verification visuelle des pages et PDF en mobile, tablette, desktop, clair et sombre.
6. Mesure du nombre de requetes et des temps de chargement avant/apres sur Affectation et dashboards.
7. Aucune erreur console, aucun flux camera actif, aucune URL objet non liberee.

## 21. Definition globale de termine

Le chantier sera considere termine lorsque :

1. Une demande publique avec responsables et photo facultative arrive dans la bonne branche.
2. La cloche affiche correctement les demandes en attente et respecte les permissions.
3. La confirmation pre-remplit l'inscription et la finalisation transactionnelle nettoie la notification active.
4. Aucun dialogue ne se ferme sur validation invalide.
5. Les tableaux de bord enseignants/personnel ont des totaux coherents et actionnables.
6. Calendrier et presences sont accessibles depuis les parametres et disposent de formulaires/rapports coherents.
7. Ponderation et affectation sont plus lisibles, rapides et sans rechargements inutiles.
8. Les PDF eleves, caisse et horaires contiennent le logo, le nom de branche, les bons filtres, totaux et titres dynamiques.
9. Les controles de type, lint, tests, permissions, responsive et accessibilite passent sans regression critique.

## 22. Points a valider avant implementation

1. Confirmer si un eleve peut avoir plusieurs responsables permanents dans le modele final ou seulement dans la demande publique.
2. Confirmer le stockage des images (service cloud existant, stockage local gere, S3/Cloudinary autre) et la taille maximale.
3. Confirmer les roles autorises a confirmer/rejeter les demandes.
4. Confirmer la devise d'affichage du rapport de caisse et l'existence eventuelle d'un solde d'ouverture.
5. Confirmer si les pages Calendrier et Presences doivent etre deplacees sous Parametres ou seulement ajoutees comme raccourcis sans changer leurs URLs actuelles.
6. Confirmer si les horaires doivent inclure une salle; le schema actuel doit etre verifie avant de promettre cette colonne.
