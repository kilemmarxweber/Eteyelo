/**
 * Politique messagerie (web + mobile Klambo)
 *
 * - Membres actifs hors élèves : read + send (parents inclus — app mobile).
 * - Élèves exclus de l'inbox.
 * - Groupes : staff / direction / owner (pas parent ni élève).
 * - Nettoyage global : propriétaire uniquement.
 * - Compte désactivé / archivé : pas d'accès.
 * - Limite : 50 destinataires. Corps : 4 000 caractères.
 */

import { isPlatformOwnerRole, ORG_ROLE } from "@/lib/permissions";

/** Élèves exclus de l'inbox (parents autorisés pour Klambo mobile). */
export const MESSAGING_EXCLUDED_ROLES = new Set<string>([ORG_ROLE.STUDENT]);

export const MESSAGING_PARENT_ROLES = new Set<string>([ORG_ROLE.PARENT]);

/** Rôles pouvant créer des groupes (hors parent / élève). */
export const MESSAGING_GROUP_ROLES = new Set<string>([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.AGENT_BUREAU,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.TEACHER,
  ORG_ROLE.SUPERVISEUR,
  ORG_ROLE.CAISSIER,
  ORG_ROLE.SUPPORT,
  "admin",
  "member",
  "director",
  "accountant",
  "teacher_titulaire",
]);

/** @deprecated Utiliser l'éligibilité + MESSAGING_GROUP_ROLES. */
export const MESSAGING_STAFF_ROLES = new Set<string>([
  ...MESSAGING_GROUP_ROLES,
  ORG_ROLE.PARENT,
]);

export type MessagingAction = "read" | "send" | "group" | "manage" | "disabled";

export function splitOrgRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function isMessagingEligibleRole(
  memberRole: string | null | undefined,
  extraRoles: string[] = [],
) {
  const roles = [
    ...splitOrgRoles(memberRole),
    ...extraRoles.map((role) => role.trim().toLowerCase()).filter(Boolean),
  ];
  // Rôle vide = éligible (membre Better Auth sans rôle explicite).
  if (roles.length === 0) return true;
  if (roles.every((role) => MESSAGING_EXCLUDED_ROLES.has(role))) return false;
  return true;
}

export function canUseMessaging(params: {
  appRole?: string | null;
  memberRole?: string | null;
  memberArchived?: boolean;
  userBanned?: boolean | null;
  organizationMessagingEnabled?: boolean;
}) {
  if (params.organizationMessagingEnabled === false) return false;
  if (params.userBanned) return false;
  if (params.memberArchived) return false;
  if (isPlatformOwnerRole(params.appRole)) return true;
  return isMessagingEligibleRole(params.memberRole);
}

export function canSendMessages(params: {
  appRole?: string | null;
  memberRole?: string | null;
  memberArchived?: boolean;
  userBanned?: boolean | null;
  organizationMessagingEnabled?: boolean;
}) {
  return canUseMessaging(params);
}

export function canCreateGroup(params: {
  appRole?: string | null;
  memberRole?: string | null;
  memberArchived?: boolean;
  userBanned?: boolean | null;
  organizationMessagingEnabled?: boolean;
}) {
  if (!canSendMessages(params)) return false;
  if (isPlatformOwnerRole(params.appRole)) return true;
  const roles = splitOrgRoles(params.memberRole);
  if (roles.length === 0) return true;
  return roles.some((role) => MESSAGING_GROUP_ROLES.has(role));
}

export function canPurgeOrganizationMessaging(params: {
  appRole?: string | null;
  memberRole?: string | null;
}) {
  if (isPlatformOwnerRole(params.appRole)) return true;
  return splitOrgRoles(params.memberRole).includes(ORG_ROLE.OWNER);
}

export function isEligibleMessagingRecipient(params: {
  memberRole?: string | null;
  extraRoles?: string[];
  memberArchived?: boolean;
  userBanned?: boolean | null;
  statusUser?: boolean | null;
}) {
  if (params.memberArchived) return false;
  if (params.userBanned) return false;
  if (params.statusUser === false) return false;
  return isMessagingEligibleRole(params.memberRole, params.extraRoles);
}

export function messagingDeniedMessage(action: MessagingAction) {
  if (action === "disabled") {
    return "La messagerie est désactivée pour cette organisation.";
  }
  if (action === "manage") {
    return "Le nettoyage de la messagerie est réservé au propriétaire de l'organisation.";
  }
  if (action === "group") {
    return "Vous ne pouvez pas créer de conversation de groupe.";
  }
  if (action === "send") {
    return "Vous ne pouvez pas envoyer de message.";
  }
  return "Accès à la messagerie refusé.";
}
