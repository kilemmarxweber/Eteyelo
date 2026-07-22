# Contexte — Invitations organisation (multi-org + contrôle owner)

> Document de plan produit / technique.  
> Objectif : faire fonctionner les invitations Better Auth pour ajouter un membre à une organisation (y compris quand l’utilisateur existe déjà / appartient à une autre org), et réserver le bouton d’invitation + sa configuration au **owner / super admin** plateforme (`APP_ROLE.OWNER`).  
> Statut : **plan — non implémenté** — juillet 2026.

---

## 1. État actuel (constat)

| Élément | Situation |
|--------|-----------|
| Plugin Better Auth | `organization()` actif dans `lib/auth.ts` + `organizationClient()` |
| Création de membres | Directe via `createOrganizationMemberAction` (createUser + `addMember`) — **pas d’invitation email** |
| UI invitation | Absente (page membres = liste + « Nouveau membre » uniquement) |
| `sendInvitationEmail` | Non configuré |
| Règle 1 org / user | `assertUserCanJoinOrganization` dans `lib/auth/org-membership.ts` — bloquée dans `beforeAddMember` et `beforeAcceptInvitation` (sauf owner plateforme) |
| Permissions | `invitation: ["create", "cancel"]` déjà dans les statements org admin (`lib/permissions.ts`) |
| Modèle DB | `Invitation` (Better Auth) + `BranchInvitation` (non branché à ce flux) |

**Blocage principal :** inviter quelqu’un déjà membre d’une autre organisation échoue avec  
« Un utilisateur ne peut appartenir qu'à une seule organisation. »

---

## 2. Objectifs produit

1. **Inviter par email** un utilisateur (existant ou nouveau) à rejoindre une organisation cible.
2. **Autoriser le cas « autre organisation »** sous contrôle explicite du owner plateforme (pas ouvert à tous les admins org par défaut).
3. **Bouton Inviter** visible / utilisable selon la config owner (pas seulement « Créer un membre »).
4. **Config invitations** (activation, expiration, multi-org, rôles invitables, etc.) **côté owner / super admin uniquement**.
5. Préserver le flux actuel de **création directe** de membre (admin org) tant que l’invitation n’est pas le seul chemin.

---

## 3. Décisions à figer avant code (Phase 0)

À trancher en Phase 0 (impacte les hooks et l’UI) :

| Décision | Options | Recommandation |
|----------|---------|----------------|
| Multi-appartenance | A) Autoriser plusieurs orgs pour un user · B) Transfert (quitter l’ancienne → rejoindre) · C) Exception owner-only (owner invite sans lever la règle pour les autres) | **C puis A optionnel** : owner peut inviter / accepter cross-org ; règle 1 org reste pour les flux non-owner tant que non activée globalement |
| Qui envoie l’invitation | Owner plateforme seulement · Owner + org `owner`/`admin` si flag org activé | **Owner seule pour le bouton + config** ; option ultérieure : déléguer aux org admins si `invitationsEnabled` sur l’org |
| Qui accepte | Lien email + session email matching Better Auth | Standard Better Auth |
| Créer compte si email inconnu | Invitation → signup → accept · Ou pré-créer user | Invitation + page accept (signup si besoin) |
| Scope config | Global plateforme · Par organisation | **Par organisation** (owner active/désactive + options) + defaults globaux |

---

## 4. Architecture cible (résumé)

```
Owner (APP_ROLE.OWNER)
  └─ Config invitations (par org ou globale)
        ├─ enabled / expiresIn / allowMultiOrg / rolesAutorisés
        └─ active le bouton « Inviter » sur l’org

Flux invite
  inviteMember(email, role, organizationId)
    → hook beforeCreateInvitation (garde config + droits)
    → sendInvitationEmail (SMTP existant)
    → utilisateur ouvre /accept-invitation?id=…
    → beforeAcceptInvitation :
         - si multi-org autorisé (config / owner) → OK
         - sinon assertUserCanJoinOrganization
    → member créé dans l’org cible
```

**Fichiers clés (prévus) :**

| Zone | Fichiers |
|------|----------|
| Auth | `lib/auth.ts` (`sendInvitationEmail`, hooks invitation) |
| Règle membership | `lib/auth/org-membership.ts` |
| Config | `lib/invitations/config.ts` (+ évent. champ `metadata` org ou table settings) |
| Email | `lib/email/send-organization-invitation-email.ts` |
| Actions | `app/admin/organizations/.../members/invitation-actions.ts` |
| UI owner | page / section config invitations (admin plateforme) |
| UI membres | bouton Inviter + liste invitations pending |
| Accept | `app/accept-invitation/page.tsx` (ou route existante équivalente) |

---

## 5. Phases d’exécution

### Phase 0 — Cadrage & contrats (½ j)

- [ ] Valider les décisions du tableau §3 avec le produit.
- [ ] Définir le schéma de config (ex. `organization.metadata.invitations` ou table dédiée).
- [ ] Lister les rôles invitables (`ORG_ROLE.*`) et messages d’erreur FR.
- [ ] Critères d’acceptation E2E (nouveaux user, user sans org, user déjà dans une autre org).

**Livrable :** ce document mis à jour (décisions figées) + checklist QA.

---

### Phase 1 — Backend auth & email (1–1,5 j)

- [ ] Ajouter `sendInvitationEmail` dans `organization({ ... })` (`lib/auth.ts`).
- [ ] Créer `send-organization-invitation-email.ts` (layout email existant + lien accept).
- [ ] Configurer `invitationExpiresIn` (défaut 7 jours, overridable via config).
- [ ] Optionnel : `cancelPendingInvitationsOnReInvite: true`.
- [ ] Étendre `beforeAcceptInvitation` / `beforeAddMember` :
  - si inviteur = owner plateforme **ou** `allowMultiOrg` activé pour l’org → skip / assouplir `assertUserCanJoinOrganization` ;
  - sinon conserver le blocage actuel.
- [ ] Ajouter hook `beforeCreateInvitation` (ou garde côté action) : invitations désactivées → refuse.

**Livrable :** invitation créable via API Better Auth + email envoyé en SMTP configuré.

---

### Phase 2 — Config côté owner / super admin (1 j)

- [ ] UI **owner only** : activer / désactiver les invitations pour une organisation.
- [ ] Paramètres : durée d’expiration, autoriser multi-org sur acceptation, rôles proposés dans le formulaire d’invite.
- [ ] Server actions + garde `isPlatformOwnerRole` (même pattern que création / suppression org).
- [ ] Persistance (metadata org ou settings plateforme) + lecture côté membres.

**Livrable :** owner peut configurer les invitations ; non-owner ne voit pas / ne peut pas muter la config.

---

### Phase 3 — Actions serveur invite / cancel / list (1 j)

- [ ] `inviteOrganizationMemberAction` : email + rôle + `organizationId` ; vérifie :
  - session owner **ou** (config enabled + permission `invitation:create`) selon décision Phase 0 ;
  - org active correcte (`setActive` / `organizationId` explicite).
- [ ] `cancelOrganizationInvitationAction` / list pending.
- [ ] Gestion erreurs claires (déjà membre, déjà invité, multi-org refusé, SMTP off).
- [ ] `revalidatePath` page membres.

**Livrable :** flux serveur complet sans UI fancy (testable via action / script).

---

### Phase 4 — UI bouton invitation + liste (1–1,5 j)

- [ ] Page membres : bouton **Inviter** (conditionné à la config + rôle).
- [ ] Dialog / page : email, rôle, envoi ; toast succès / erreur.
- [ ] Onglet ou section **Invitations en attente** (renvoyer / annuler).
- [ ] Garder le bouton **Créer un membre** (création directe) pour les cas internes.
- [ ] Masquer le bouton Inviter si config off ou si l’utilisateur n’est pas autorisé (owner-first).

**Livrable :** owner (puis éventuellement org admin si délégué) invite depuis l’UI.

---

### Phase 5 — Page acceptation invitation (1 j)

- [ ] Route publique/authentifiée `/accept-invitation` (ou `/invite/[id]`).
- [ ] Si non connecté → login/signup puis retour sur le lien.
- [ ] Vérifier email session = email invitation.
- [ ] Appeler `acceptInvitation` Better Auth ; gérer multi-org selon Phase 1.
- [ ] Redirection post-accept vers l’org / branche / onboarding adapté (`resolve-user-organization-path`).

**Livrable :** parcours bout-en-bout email → membre actif.

---

### Phase 6 — Durcissement, tests, polish (1 j)

- [ ] Tests unitaires hooks membership (single-org vs allowMultiOrg vs owner bypass).
- [ ] Test manuel : invite vers org B d’un user déjà dans org A.
- [ ] Vérifier permissions sidebar / guards (pas de fuite du bouton config hors owner).
- [ ] Logs / messages FR cohérents ; expiration & re-invite.
- [ ] Documenter le comportement final dans ce fichier (statut → livré).

**Livrable :** feature stable + doc à jour.

---

## 6. Ordre d’implémentation recommandé

```
Phase 0 (décisions)
    → Phase 1 (auth + email + hooks)
        → Phase 2 (config owner)
            → Phase 3 (actions)
                → Phase 4 (UI bouton)
                    → Phase 5 (accept)
                        → Phase 6 (tests)
```

Phases 2 et 3 peuvent partiellement chevaucher une fois le schéma de config fixé.

---

## 7. Hors scope (pour l’instant)

- Invitations **branche** (`BranchInvitation`) — modèle existant, flux séparé.
- Remplacer totalement la création directe de membres.
- Multi-org libre pour tous les utilisateurs sans flag owner.
- Invitations en masse (CSV) / SSO.

---

## 8. Comment tester (cible après livrables)

1. Se connecter en **super admin / owner**.
2. Ouvrir une organisation → activer les invitations (+ option multi-org si besoin).
3. Sur **Membres**, cliquer **Inviter** → email + rôle.
4. Cas A : email inconnu → créer compte → accepter → membre de l’org.
5. Cas B : user déjà dans une **autre** org → avec multi-org / bypass owner → accept OK ; sans → message d’erreur clair.
6. Vérifier qu’un admin org **non owner** ne peut pas modifier la config (et ne voit le bouton que si délégué).

---

## 9. Références code existantes

- `lib/auth.ts` — plugin `organization`, hooks `beforeAddMember` / `beforeAcceptInvitation`
- `lib/auth/org-membership.ts` — règle 1 org
- `lib/permissions.ts` — `invitation` + `APP_ROLE.OWNER`
- `app/admin/organizations/[organizationId]/members/*` — UI / actions membres actuelles
- `lib/email/*` — patterns d’envoi SMTP
- Skill Better Auth org : `.agents/skills/organization-best-practices/SKILL.md`
