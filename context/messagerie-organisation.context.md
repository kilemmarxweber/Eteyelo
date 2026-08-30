# Contexte de travail — Messagerie organisationnelle Eteyelo

> Ce fichier résume les décisions et contraintes à garder en mémoire pendant l'implémentation. Le plan détaillé se trouve dans `PLAN_MESSAGERIE_ORGANISATION.md`.

## Demande utilisateur

Ajouter dans Eteyelo une messagerie interne inspirée de Teams / WhatsApp pour permettre aux membres des différentes branches d'une même organisation de communiquer.

Besoins exprimés :

- champ de sélection multiple des utilisateurs ;
- saisie et réception des messages ;
- notification lorsqu'un message est envoyé ;
- réponse directe depuis les demandes de justification et les notifications existantes ;
- interface bien conçue, utilisable sur ordinateur et mobile.

## État existant à réutiliser

- Les utilisateurs sont reliés à une organisation via `Member`.
- Les appartenances aux établissements sont représentées par `BranchMember`.
- Les rôles et permissions sont centralisés dans `lib/permissions.ts`.
- L'accès à une branche passe par `requireBranchContext`.
- `AppNotification` existe déjà pour les absences, paiements et demandes de modification de note.
- `components/notification-bell.tsx` affiche les notifications et rafraîchit le compteur périodiquement.
- Les demandes de justification disposent déjà d'un flux de notification, de lecture et de réponse.

## Décisions de conception recommandées

1. La messagerie est **scopée à l'organisation**, pas à une seule branche :
   `/admin/organizations/[organizationId]/messagerie`.
2. Un destinataire crée une conversation directe.
3. Plusieurs destinataires créent un groupe partagé, et non plusieurs copies privées du message.
4. Une réponse liée à une justification utilise une conversation contextuelle avec `contextType` + `contextId`.
5. Les participants ne voient que leurs propres conversations.
6. Un destinataire doit être un membre actif de la même organisation.
7. Les membres de branches différentes d'une même organisation peuvent échanger si la matrice des droits l'autorise.
8. Chaque utilisateur peut archiver/désarchiver une conversation pour lui-même et archiver/désarchiver un message seul pour lui-même.
9. Seul le propriétaire de l'organisation peut nettoyer globalement la messagerie ; ce nettoyage doit être contrôlé, confirmé et audité.
10. La V1 ne comprend pas de pièces jointes, de modification libre de message ni de WebSocket.
11. La V1 utilise les notifications internes et le polling déjà présent ; e-mail, SMS, WhatsApp et temps réel sont prévus pour une V2.
12. Le droit minimum recommandé est `messaging:read` + `messaging:send`. La création de groupe et la participation des élèves/parents doivent être confirmées avant le code.

## Modèle minimal envisagé

```text
Conversation
  ├── organizationId
  ├── type: DIRECT | GROUP | CONTEXTUAL
  ├── subject?
  ├── contextType?
  └── contextId?

ConversationParticipant
  ├── conversationId
  ├── userId
  ├── lastReadAt?
  └── archivedAt?

Message
  ├── conversationId
  ├── senderId
  ├── body
  ├── replyToId?
  └── clientMessageId

UserMessageArchive
  ├── userId
  ├── messageId
  └── archivedAt
```

Pour les notifications de message, réutiliser `AppNotification` si son modèle est étendu avec `organizationId`, `conversationId` et `messageId`. Sinon créer une table dédiée. Ne jamais stocker le contenu complet du message uniquement dans la notification.

Un `archivedAt` ne doit pas être ajouté directement sur `Message`, car cela archiverait le message pour tous les participants. `UserMessageArchive` permet un archivage personnel.

Règle d'archivage :

- un utilisateur peut archiver sa conversation pour sa propre boîte ;
- un utilisateur peut archiver un message seul pour sa propre vue ;
- les autres participants continuent de voir le message ;
- un nouveau message fait réapparaître la conversation archivée ;
- seul le propriétaire peut nettoyer globalement les messages et conversations.

## Contraintes de sécurité

- Ne jamais faire confiance aux `organizationId`, `senderId` ou destinataires envoyés par le navigateur.
- Vérifier l'organisation, le statut actif et l'appartenance à la conversation côté serveur.
- Vérifier les droits de la demande liée avant une réponse contextuelle.
- Refuser les utilisateurs archivés ou d'une autre organisation.
- Un utilisateur ne peut archiver que sa propre vue ; il ne peut pas retirer un message chez les autres.
- Le nettoyage complet est réservé au propriétaire et doit préserver les éléments soumis à conservation.
- Valider avec Zod, limiter la taille du message à environ 4 000 caractères et échapper le contenu à l'affichage.
- Ajouter une limite de fréquence et une clé d'idempotence pour éviter les doubles envois.
- Conserver des index sur organisation, conversation, participant, expéditeur et date.

## Fichiers probables

```text
prisma/schema.prisma
lib/permissions.ts
lib/auth/branch-area-permissions.ts
lib/actions/messaging.actions.ts
lib/messaging/messaging-policy.ts
lib/messaging/messaging-types.ts
  Actions d'archivage :
  archiveConversation / unarchiveConversation
  archiveMessage / unarchiveMessage
  purgeOrganizationMessaging (propriétaire uniquement)
components/notification-bell.tsx
components/messaging/
app/admin/organizations/[organizationId]/messagerie/
```

## Questions bloquantes avant développement

- Les élèves et les parents peuvent-ils envoyer des messages ou seulement les recevoir ?
- Un groupe peut-il réunir toutes les branches sans validation d'un responsable ?
- Quelle est la limite de destinataires d'un groupe ?
- Combien de temps conserver les conversations ?
- Les réponses contextuelles doivent-elles être visibles dans la messagerie générale ou uniquement dans le dossier concerné ?

## Hors périmètre V1

- appels audio/vidéo ;
- pièces jointes et partage de fichiers ;
- messages externes WhatsApp/SMS ;
- présence en ligne et indicateur de saisie ;
- chiffrement de bout en bout ;
- modération automatique ;
- édition et suppression libre des messages pour les utilisateurs standards ;
- purge globale non contrôlée.

## Référence

Lire `PLAN_MESSAGERIE_ORGANISATION.md` pour les phases, les actions serveur, l'UX, le schéma proposé, les tests et les critères de validation.

