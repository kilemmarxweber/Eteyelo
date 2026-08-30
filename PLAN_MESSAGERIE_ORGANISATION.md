# Plan — Messagerie interne entre les branches d'une organisation

> Objectif : permettre aux membres actifs d'une même organisation de communiquer entre eux, même lorsqu'ils appartiennent à des branches différentes, avec une interface inspirée de Teams / WhatsApp, un sélecteur multiple de destinataires et une notification à chaque nouveau message.

**Produit :** Eteyelo / KlamboCore  
**Statut :** cadrage proposé — aucune implémentation de messagerie à ce jour  
**Date :** 2026-08-30  
**Contexte complémentaire :** `context/messagerie-organisation.context.md`

---

## 1. Reformulation du besoin

Le besoin est une messagerie interne, sécurisée par l'organisation, comprenant :

- des conversations directes à deux personnes ;
- des conversations de groupe créées en sélectionnant plusieurs utilisateurs ;
- des échanges entre membres de branches différentes de la même organisation ;
- un droit simple de **saisir/envoyer** et de **recevoir/lire** ;
- aucune permission de gestion avancée pour les utilisateurs standards : pas de gestion des membres, pas de suppression globale, pas de modification des droits ;
- un indicateur de message non lu et une notification après chaque envoi ;
- une réponse directe depuis une notification, en particulier pour les demandes de justification et les autres demandes nécessitant un retour.

### Amélioration importante de l'idée

Le sélecteur multiple ne doit pas envoyer une série de messages isolés. Le comportement recommandé est :

```text
1 destinataire  → conversation directe
2 destinataires ou plus → conversation de groupe
réponse à une demande → conversation contextuelle liée à la demande
```

Ainsi, tous les destinataires voient le même fil et les réponses ne sont pas dispersées.

La messagerie doit être positionnée au niveau **organisation**, et non dans une seule branche. La branche d'origine et la branche de chaque participant restent toutefois visibles pour respecter le contexte et les règles d'accès.

---

## 2. Principes métier proposés

### 2.1 Portée des utilisateurs

1. Un utilisateur peut communiquer uniquement avec des membres actifs de la **même organisation**.
2. Le sélecteur affiche uniquement les membres non archivés, avec :
   - nom et photo ;
   - rôle ;
   - branche(s) d'appartenance ;
   - statut actif.
3. Un membre d'une branche peut écrire à un membre d'une autre branche si tous deux appartiennent à la même organisation.
4. Un utilisateur ne peut jamais découvrir ou sélectionner un membre d'une autre organisation.
5. Les comptes désactivés, archivés ou supprimés ne peuvent plus recevoir de nouveaux messages.
6. Les conversations historiques restent consultables selon la politique de conservation retenue.

### 2.2 Droits minimaux

Le modèle doit distinguer les droits suivants :

- `messaging:read` : lire ses conversations et ses messages ;
- `messaging:send` : envoyer un message aux destinataires autorisés ;
- `messaging:group` : créer une conversation avec plusieurs personnes ;
- `messaging:manage` : réservé aux responsables, pour la modération ou les réglages.

Recommandation par défaut :

- membres actifs, enseignants, personnel, parents et élèves autorisés : `read` + `send` selon le périmètre produit ;
- création de groupe : autorisée à tous les utilisateurs ayant `send`, avec une limite de destinataires ;
- modération et réglages : responsables uniquement ;
- nettoyage global de toutes les conversations/messages : propriétaire de l'organisation uniquement ;
- aucun utilisateur standard ne peut modifier ou supprimer le message d'un autre utilisateur.

> Point à valider avant le développement : confirmer si les élèves et les parents disposent eux aussi de `read` + `send`, ou si la V1 est réservée au personnel et aux enseignants. Cette décision change les règles de confidentialité.

### 2.3 Confidentialité

- Les participants voient uniquement les conversations auxquelles ils appartiennent.
- Un message envoyé à plusieurs personnes ne crée pas de copie privée par destinataire.
- Le contenu d'une conversation n'est jamais visible dans la liste globale des membres.
- Les informations sensibles (notes, santé, discipline, paiement) ne doivent pas être préremplies dans le texte d'une notification.
- Pour une demande de justification, la notification contient un résumé minimal et renvoie vers le dossier protégé.

### 2.4 Archivage individuel et nettoyage global

Chaque utilisateur doit pouvoir gérer sa propre boîte sans supprimer le contenu pour les autres :

1. **Archiver une conversation pour soi** : la conversation disparaît de sa boîte principale, mais reste accessible dans « Archives ».
2. **Désarchiver** : l'utilisateur peut restaurer la conversation dans sa boîte.
3. **Archiver un message seul** : l'utilisateur peut masquer uniquement ce message dans sa propre vue, sans le retirer du fil des autres participants.
4. **Nouveau message dans une conversation archivée** : la conversation revient dans la boîte principale du destinataire et une notification est créée.
5. **L'expéditeur ne peut pas effacer le message chez les autres participants**.
6. **Seul le propriétaire de l'organisation** peut lancer un nettoyage global de la messagerie.

Le nettoyage global du propriétaire doit être une suppression logique ou une purge contrôlée, avec :

- confirmation explicite ;
- filtre par conversation, période ou organisation ;
- journal d'audit ;
- avertissement irréversible si une purge physique est activée ;
- conservation des éléments nécessaires aux demandes de justification, aux paiements ou aux autres obligations de traçabilité.

Le droit d'archiver est donc personnel ; le droit de nettoyer est organisationnel et réservé au propriétaire. Un gestionnaire, un administrateur de branche ou un participant ne peut pas vider les archives d'un autre utilisateur.

Chaque utilisateur peut donc archiver une conversation ou un message seul dans sa propre boîte. L'archivage ne modifie pas le message original et ne change pas la boîte des autres participants.

### 2.5 Notifications

À la création d'un message :

1. le message est enregistré ;
2. une notification interne est créée pour chaque participant destinataire ;
3. le compteur non lu est actualisé ;
4. le destinataire peut ouvrir directement la conversation ;
5. pour un message contextuel, le bouton peut ouvrir la demande liée.

La notification interne est obligatoire en V1. L'e-mail, le SMS, WhatsApp et les notifications push sont des extensions ultérieures, car ils nécessitent une configuration de fournisseur, des préférences utilisateur et une gestion des erreurs de livraison.

---

## 3. Parcours UX cible

### 3.1 Accès

Ajouter une entrée **Messagerie** au niveau organisation :

```text
/admin/organizations/[organizationId]/messagerie
```

La page ne dépend pas de `branchId`, car une conversation peut réunir plusieurs branches.

Dans le shell organisation :

- icône de messagerie ;
- badge du nombre de conversations non lues ;
- accès à la messagerie depuis une notification ;
- affichage de la branche à côté du nom de chaque participant.

Un accès secondaire peut être ajouté au niveau branche, mais il doit simplement rediriger vers la messagerie organisationnelle.

### 3.2 Écran type Teams / WhatsApp

```text
┌──────────────────────┬─────────────────────────────────────┐
│ Rechercher            │ Conversation                        │
│ + Nouveau message     │ Alice · Branche Primaire            │
│                       │ ----------------------------------- │
│ Non lus (3)           │ Message reçu ...                    │
│                       │ Réponse ...                         │
│ • Direction           │                                     │
│ • Branche Primaire   │ [Écrire un message...]          [➤] │
│ • Groupe enseignants │                                     │
└──────────────────────┴─────────────────────────────────────┘
```

Composants :

- liste des conversations ;
- recherche par nom, rôle, branche ou texte local ;
- filtre `Toutes / Non lues / Groupes / Directes` ;
- filtre `Archivées` ;
- fenêtre de conversation ;
- champ de saisie avec longueur maximale ;
- bouton envoyer ;
- action `Archiver la conversation` visible pour chaque utilisateur sur sa propre vue ;
- action `Archiver ce message` sur chaque message ;
- action `Désarchiver` depuis les archives ;
- action `Désarchiver ce message` depuis les messages archivés ;
- action `Nettoyer la messagerie` visible uniquement pour le propriétaire ;
- état `envoyé`, `reçu` puis éventuellement `lu` ;
- date et heure ;
- nom + branche de l'expéditeur ;
- réponse directe à un message via `replyToId` ;
- état vide et état hors connexion explicites.

### 3.3 Création d'une conversation

Le formulaire **Nouveau message** doit contenir :

1. un champ de recherche des membres ;
2. un `select multiple` ou une liste multi-sélection accessible au clavier ;
3. des badges supprimables pour les destinataires choisis ;
4. un aperçu de la branche et du rôle ;
5. un champ objet facultatif pour les groupes ;
6. le champ message ;
7. un compteur de caractères ;
8. un bouton **Envoyer** désactivé sans destinataire ni contenu.

Améliorations recommandées :

- ne pas charger toute la liste des membres dans le navigateur ;
- utiliser une recherche serveur avec debounce ;
- limiter le nombre de destinataires en V1, par exemple 50 ;
- afficher un avertissement avant un groupe important ;
- empêcher les doubles clics avec une clé d'idempotence ;
- conserver les destinataires sélectionnés si la validation du texte échoue.

### 3.4 Réponse depuis une demande

Pour une demande d'absence, de justification ou de modification de note :

```text
Notification
  ├── Voir le dossier
  └── Répondre directement
        ↓
Conversation contextuelle
  ├── demandeType = ABSENCE_CASE / GRADE_MODIFICATION
  └── demandeId = identifiant protégé
```

La réponse directe ne doit pas exposer la demande à un utilisateur qui n'a pas déjà le droit de la consulter. Le serveur doit revérifier l'autorisation lors de l'ouverture et lors de l'envoi.

---

## 4. Modèle de données proposé

Le système actuel possède `AppNotification`, mais ce modèle est actuellement rattaché à une branche et à quelques types métier. Il faut éviter de détourner ce modèle pour stocker les messages eux-mêmes.

### 4.1 Conversation

```prisma
model Conversation {
  id             String               @id @default(cuid())
  organizationId String
  type           ConversationType     @default(DIRECT)
  subject        String?
  createdById    String
  sourceBranchId String?
  contextType    ConversationContextType?
  contextId      String?
  archivedAt     DateTime?
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  participants   ConversationParticipant[]
  messages       Message[]

  @@index([organizationId, updatedAt])
  @@index([organizationId, archivedAt])
  @@index([contextType, contextId])
}
```

### 4.2 Participants

```prisma
model ConversationParticipant {
  id             String       @id @default(cuid())
  conversationId String
  userId         String
  joinedAt       DateTime     @default(now())
  lastReadAt     DateTime?
  archivedAt     DateTime?
  mutedAt        DateTime?
  leftAt         DateTime?

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@index([userId, lastReadAt, archivedAt])
}
```

### 4.3 Archivage personnel d'un message

Un champ `archivedAt` sur `Message` serait incorrect, car il archiverait le message pour tout le monde. Utiliser une table de liaison :

```prisma
model UserMessageArchive {
  id         String   @id @default(cuid())
  userId     String
  messageId  String
  archivedAt DateTime @default(now())

  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  message    Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([userId, messageId])
  @@index([userId, archivedAt])
}
```

Les messages archivés restent en base et peuvent être restaurés uniquement par l'utilisateur concerné. Le propriétaire peut les inclure dans un nettoyage global, sous réserve de la politique de conservation.

### 4.4 Messages

```prisma
model Message {
  id             String       @id @default(cuid())
  conversationId String
  senderId       String
  body           String       @db.Text
  replyToId      String?
  clientMessageId String?
  createdAt      DateTime     @default(now())
  editedAt       DateTime?
  deletedAt      DateTime?

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation("SentMessages", fields: [senderId], references: [id], onDelete: Cascade)
  replyTo        Message?     @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies        Message[]    @relation("MessageReplies")

  @@index([conversationId, createdAt])
  @@index([senderId, createdAt])
  @@unique([senderId, clientMessageId])
}
```

### 4.5 Enums

```prisma
enum ConversationType {
  DIRECT
  GROUP
  CONTEXTUAL
}

enum ConversationContextType {
  ABSENCE_CASE
  GRADE_MODIFICATION
  REGISTRATION_REQUEST
  SUPPORT_TICKET
}
```

### 4.6 Notifications

Deux options sont possibles :

1. étendre `AppNotification` avec `organizationId`, `branchId?`, `conversationId?` et `messageId?` ;
2. créer une table `MessageNotification` dédiée.

**Choix recommandé :** étendre `AppNotification` pour réutiliser la cloche existante, mais rendre `branchId` optionnel uniquement pour les notifications organisationnelles et ajouter :

```prisma
organizationId String
conversationId String?
messageId      String?
```

La notification d'un message doit être dédupliquée par `messageId + userId`. Pour une conversation inter-branches, `organizationId` est la portée de sécurité ; `branchId` devient la branche d'origine facultative.

---

## 5. Architecture et sécurité

### 5.1 Actions serveur

Créer un module dédié, par exemple :

```text
lib/actions/messaging.actions.ts
lib/messaging/messaging-policy.ts
lib/messaging/messaging-types.ts
```

Actions minimales :

- `searchMessagingRecipientsAction`;
- `createConversationAction`;
- `listMyConversationsAction`;
- `getConversationMessagesAction`;
- `sendMessageAction`;
- `markConversationReadAction`;
- `archiveConversationAction` / `unarchiveConversationAction`;
- `archiveMessageAction` / `unarchiveMessageAction`;
- `purgeOrganizationMessagingAction` (propriétaire uniquement) ;
- `toggleConversationMuteAction` (optionnel V1).

Toutes les actions doivent :

1. obtenir la session Better Auth ;
2. vérifier l'appartenance à l'organisation ;
3. vérifier que l'utilisateur est participant avant toute lecture ;
4. vérifier chaque destinataire dans la même organisation ;
5. appliquer les droits `messaging:*` côté serveur ;
6. valider le texte avec Zod ;
7. exécuter la création du message et des notifications dans une transaction ;
8. ne jamais accepter `organizationId` ou `userId` provenant du client comme preuve d'autorisation.

### 5.2 Permissions

Ajouter une ressource dans `lib/permissions.ts` :

```ts
messaging: ["read", "send", "group", "manage"]
```

Ajouter une zone dans `lib/auth/branch-area-permissions.ts` uniquement pour les éventuels liens depuis une branche. La page principale doit être protégée par une permission organisationnelle, car elle n'est pas limitée à `branchId`.

Les contrôles UI servent seulement à améliorer l'expérience. L'autorisation réelle doit rester dans les actions serveur et les requêtes Prisma.

### 5.3 Validation du contenu

- texte obligatoire après trim ;
- longueur maximale recommandée : 4 000 caractères en V1 ;
- refus du HTML et des scripts ;
- échappement à l'affichage ;
- limitation de fréquence par utilisateur ;
- journalisation minimale de l'auteur, de la conversation et de la date ;
- pas de pièce jointe en V1 ;
- pas de modification du message en V1, pour garder une règle simple ;
- suppression logique réservée à une future politique de conservation.

---

## 6. Notification et mise à jour de l'interface

### V1 sans infrastructure temps réel

Le projet possède déjà un rafraîchissement périodique de la cloche de notifications. Pour réduire le risque :

- utiliser une notification interne immédiate ;
- rafraîchir le compteur toutes les 10 à 15 secondes ;
- rafraîchir la liste active de conversation selon la même stratégie ;
- déclencher un événement navigateur après envoi pour actualiser la cloche et la liste ;
- afficher un état `Nouveau message` sans perdre la position de lecture.

### V2 temps réel

Après validation de la V1, étudier SSE ou WebSocket pour :

- nouveau message instantané ;
- présence en ligne ;
- statut reçu/lu ;
- indicateur de saisie ;
- mise à jour multi-onglets.

Il est déconseillé d'introduire WebSocket avant d'avoir stabilisé le modèle de droits et les règles de notification.

---

## 7. Phases d'exécution

### Phase 0 — Validation fonctionnelle

- [ ] Décider si élèves et parents peuvent envoyer des messages.
- [ ] Décider si les groupes peuvent contenir des membres de toutes les branches.
- [ ] Fixer la limite de destinataires.
- [ ] Fixer la durée de conservation et la politique d'archivage.
- [ ] Confirmer que les pièces jointes sont hors V1.
- [ ] Confirmer le comportement d'une conversation avec un membre ensuite désactivé.

**Livrable :** mini-spécification validée et matrice des droits.

### Phase 1 — Schéma et politiques

- [ ] Ajouter `Conversation`, `ConversationParticipant` et `Message`.
- [ ] Ajouter `ConversationParticipant.archivedAt` pour l'archivage individuel.
- [ ] Ajouter `UserMessageArchive` pour l'archivage d'un message seul par utilisateur.
- [ ] Ajouter les enums de type et de contexte.
- [ ] Étendre `AppNotification` ou créer `MessageNotification`.
- [ ] Ajouter les indexes et la contrainte d'idempotence.
- [ ] Écrire `messaging-policy.ts`.
- [ ] Créer la migration Prisma et régénérer le client.

### Phase 2 — API / actions sécurisées

- [ ] Implémenter la recherche paginée des destinataires.
- [ ] Implémenter la création directe/groupe.
- [ ] Implémenter la liste paginée des conversations.
- [ ] Implémenter la lecture paginée des messages.
- [ ] Implémenter l'envoi transactionnel + notifications.
- [ ] Implémenter le marquage lu.
- [ ] Implémenter l'archivage/désarchivage personnel des conversations.
- [ ] Implémenter l'archivage/désarchivage d'un message seul.
- [ ] Implémenter le nettoyage global avec contrôle strict du rôle propriétaire.
- [ ] Ajouter rate limiting et validation Zod.

### Phase 3 — Interface messagerie

- [ ] Ajouter la route organisationnelle `/messagerie`.
- [ ] Ajouter la navigation et le badge non lu.
- [ ] Créer la liste de conversations.
- [ ] Créer la recherche de membres avec multi-sélection.
- [ ] Créer la vue de conversation.
- [ ] Créer le champ de saisie et les états d'envoi.
- [ ] Ajouter l'affichage rôle/branche.
- [ ] Ajouter les états vide, chargement, erreur et hors connexion.

### Phase 4 — Intégration des demandes

- [ ] Ajouter un bouton `Répondre` sur les notifications de justification.
- [ ] Créer ou retrouver une conversation contextuelle par type + identifiant.
- [ ] Vérifier les droits sur la demande avant d'ouvrir le fil.
- [ ] Afficher un lien protégé vers le dossier d'origine.
- [ ] Tester la réponse directe après acceptation ou rejet d'une justification.

### Phase 5 — Qualité, sécurité et recette

- [ ] Tester l'isolation entre deux organisations.
- [ ] Tester l'accès inter-branches dans une même organisation.
- [ ] Tester l'impossibilité de lire une conversation sans participation.
- [ ] Tester l'impossibilité d'envoyer à un membre archivé.
- [ ] Tester qu'un utilisateur archive seulement sa propre conversation ou son propre message.
- [ ] Tester qu'un autre participant voit toujours un message archivé par quelqu'un.
- [ ] Tester que le nettoyage global est refusé à tous les rôles sauf au propriétaire.
- [ ] Tester le multi-sélecteur clavier et mobile.
- [ ] Tester le double envoi et l'idempotence.
- [ ] Tester les notifications dupliquées.
- [ ] Tester les limites de taille et de fréquence.
- [ ] Tester les performances sur une organisation avec beaucoup de membres.

---

## 8. Fichiers à créer ou modifier

```text
prisma/schema.prisma
lib/permissions.ts
lib/auth/branch-area-permissions.ts
lib/auth/session-roles.ts
lib/actions/messaging.actions.ts
lib/messaging/messaging-policy.ts
lib/messaging/messaging-types.ts
lib/notification-events.ts
components/notification-bell.tsx
components/messaging/
app/admin/organizations/[organizationId]/messagerie/
```

Fichiers à réutiliser comme références :

- `lib/actions/notification.actions.ts` pour le contexte et le badge ;
- `lib/actions/absence.actions.ts` pour les notifications et les réponses contextuelles ;
- `lib/auth/require-branch-context.ts` pour les contrôles de session ;
- `lib/permissions.ts` pour les ressources DAC ;
- `components/notification-bell.tsx` pour l'accès rapide et le rafraîchissement.

---

## 9. Critères de validation

La V1 sera considérée comme terminée lorsque :

1. un membre peut créer une conversation directe avec un membre autorisé ;
2. un membre peut sélectionner plusieurs utilisateurs et créer un groupe commun ;
3. une conversation peut réunir des utilisateurs de plusieurs branches de la même organisation ;
4. aucun utilisateur ne peut voir ou sélectionner un membre d'une autre organisation ;
5. seuls les participants peuvent lire les messages ;
6. chaque destinataire reçoit une notification interne et le compteur non lu augmente ;
7. ouvrir la notification mène à la bonne conversation ;
8. une réponse à une justification peut être envoyée directement depuis son contexte autorisé ;
9. chaque utilisateur peut archiver et désarchiver une conversation uniquement pour sa propre boîte ;
10. chaque utilisateur peut archiver et désarchiver un message seul uniquement dans sa propre vue ;
11. un message archivé par un utilisateur reste visible pour les autres participants ;
12. un nouveau message réactive correctement une conversation archivée et crée une notification ;
13. seul le propriétaire peut nettoyer globalement la messagerie ;
14. les doublons de message causés par un double clic sont évités ;
15. les messages trop longs, vides ou envoyés trop rapidement sont refusés proprement ;
16. aucune pièce jointe ni gestion administrative n'est disponible pour un utilisateur standard ;
17. la navigation mobile reste utilisable.

---

## 10. Estimation indicative

```text
Phase 0 — validation                  0,5 à 1 jour
Phase 1 — schéma et politiques        2 à 3 jours
Phase 2 — actions sécurisées          3 à 5 jours
Phase 3 — interface                   4 à 7 jours
Phase 4 — demandes contextuelles     2 à 3 jours
Phase 5 — tests et recette            2 à 4 jours
Total V1                              13 à 23 jours
```

Le temps dépend surtout de la décision concernant les élèves/parents, de la réutilisation de `AppNotification` et du niveau de finition mobile attendu.

---

## 11. Risques et décisions à ne pas repousser

- **Confusion groupe / diffusion :** une sélection multiple doit créer un fil partagé, pas des messages privés indépendants.
- **Portée branche vs organisation :** une route uniquement sous `branchId` rendrait les échanges inter-branches difficiles et favoriserait les contournements.
- **Droit d'envoi trop large :** autoriser tous les comptes sans politique peut produire du spam ou exposer des mineurs ; la matrice des droits doit être validée.
- **Archivage confondu avec suppression :** l'utilisateur archive uniquement sa vue ; il ne doit jamais supprimer le message chez les autres participants.
- **Nettoyage global trop puissant :** seul le propriétaire peut l'exécuter, avec confirmation et audit ; la purge physique doit rester exceptionnelle.
- **Notifications existantes branch-scoped :** `AppNotification.branchId` doit être adapté pour les messages organisationnels.
- **Temps réel prématuré :** le polling suffit pour la V1 et permet de valider le métier avant d'ajouter une infrastructure persistante.
- **Pièces jointes :** elles impliquent antivirus, stockage, droits, quotas et modération ; les exclure de la V1 réduit fortement le risque.
- **Demandes sensibles :** une réponse contextuelle doit conserver les vérifications d'accès de la demande d'origine.

---

## 12. Ordre recommandé

```text
Validation droits et confidentialité
        ↓
Schéma + politique d'accès
        ↓
Actions sécurisées + notifications
        ↓
Messagerie organisationnelle
        ↓
Réponse aux demandes de justification
        ↓
Tests d'isolation + recette mobile
        ↓
Temps réel, pièces jointes et notifications externes (V2)
```

