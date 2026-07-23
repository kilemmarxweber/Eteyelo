# Contexte — Invitations organisation (multi-org + contrôle owner)

> Document de plan produit / technique.  
> Objectif : faire fonctionner les invitations Better Auth pour ajouter un membre à une organisation (y compris quand l’utilisateur existe déjà / appartient à une autre org), et réserver le bouton d’invitation + sa configuration au **owner / super admin** plateforme (`APP_ROLE.OWNER`).  
> Statut : **livré phases 0–6 (MVP)** — juillet 2026.

---

## 1. État actuel (après implémentation)

| Élément | Situation |
|--------|-----------|
| Plugin Better Auth | `sendInvitationEmail`, hooks invitation, `invitationExpiresIn` 7j |
| Config | `organization.metadata.invitations` via `lib/invitations/config.ts` |
| UI config | `/admin/organizations/[id]/invitations` — **owner only** |
| UI invite | Page membres : bouton **Inviter** si config `enabled` + owner |
| Accept | `/accept-invitation?invitationId=…` |
| Multi-org | Autorisé à l’acceptation si `enabled && allowMultiOrg` — **aucune copie de données** |
| Création directe | Conservée (« Ajouter un membre ») |

---

## 2. Objectifs produit

1. **Inviter par email** un utilisateur (existant ou nouveau) à rejoindre une organisation cible.
2. **Autoriser le multi-org** uniquement via invitation acceptée (jamais sans invite).
3. **Isolation stricte** : pas de transfert de données entre orgs ; chaque org = contexte métier séparé.
4. **Bouton Inviter** + **config** réservés au **owner / super admin** plateforme.
5. Préserver le flux actuel de **création directe** de membre (admin org) tant que l’invitation n’est pas le seul chemin.

---

## 3. Décisions produit — **figées** (isolation & accès)

### 3.0 Mot de passe temporaire

| Règle | Comportement |
|-------|----------------|
| Invite cross-org | Si le user existe déjà dans une autre org et `mustChangePassword`, **invitation refusée**. |
| Accept invitation | Si `mustChangePassword`, redirection forcée vers `/auth/change-password?callbackUrl=/accept-invitation…` puis retour pour accepter. |
| Multi-org login | Si plusieurs orgs accessibles → `/admin/organization-picker`. Orgs/membres archivés exclus. |
| Archiver membre | Action `archiveOrganizationMemberAction` (soft) : bloque l’accès à cette org uniquement. |

### 3.1 Garanties d’accès (qui apparaît où)

| Règle | Comportement |
|-------|----------------|
| Sans invitation acceptée | Un user **n’apparaît jamais** comme membre d’une autre org. |
| Seule porte d’entrée cross-org | Invitation owner → acceptation email matching. |
| Multi-org | Même compte, plusieurs rows `member` (une par org), via invite only. |

### 3.2 Isolation des données

| Règle | Comportement |
|-------|----------------|
| Pas de migration | Accept invitation org B ≠ copie depuis org A. |
| Zéro dans la nouvelle org | Membership + rôle de l’invite uniquement. |
| Cloisonnement | Queries filtrées par `organizationId` / org active. |

### 3.3 Rôle obligatoire

| Règle | Comportement |
|-------|----------------|
| Payload | `email` + `role` + `organizationId` obligatoires. |
| Portée | Rôle = org cible uniquement. |

---

## 4. Fichiers livrés

| Zone | Fichiers |
|------|----------|
| Config | `lib/invitations/config.ts`, `lib/invitations/messages.ts` |
| Auth | `lib/auth.ts`, `lib/auth/org-membership.ts` |
| Email | `lib/email/send-organization-invitation-email.ts` |
| Actions | `.../members/invitation-actions.ts` |
| UI owner | `.../invitations/page.tsx`, `invitations-config-form.tsx` |
| UI membres | `members/page.tsx`, `members-view.tsx`, `invite-member-controls.tsx` |
| Accept | `app/accept-invitation/*` |
| Tests | `scripts/test-organization-invitations-config.ts` |

---

## 5. Phases d’exécution

### Phase 0 — Cadrage — **fait**
### Phase 1 — Auth & email — **fait**
### Phase 2 — Config owner — **fait**
### Phase 3 — Actions invite/cancel/list/accept — **fait**
### Phase 4 — UI bouton + pending — **fait**
### Phase 5 — Page acceptation — **fait**
### Phase 6 — Tests config + doc — **fait**

---

## 6. Comment tester

1. Se connecter en **super admin / owner**.
2. Org → **Invitations** → activer + multi-org + rôles → Enregistrer.
3. Org → **Membres** → **Inviter un membre** → email + rôle.
4. Ouvrir le lien `/accept-invitation?invitationId=…` (ou logs console en dev si SMTP off).
5. Se connecter avec l’email invité → Accepter → membre de l’org, données A intactes.
6. Non-owner : pas de carte Invitations, pas de bouton Inviter.

---

## 7. Hors scope (inchangé)

- Invitations branche (`BranchInvitation`)
- Remplacer la création directe de membres
- Multi-org sans invitation
- Invitations CSV / SSO
