/**
 * Libellés FR pour la matrice de permissions (UI `/roles`).
 * Format cible : `Ressource · Action` (ex. `Finance · Encaisser`).
 */

import { accessControlStatements } from "@/lib/permissions";

const RESOURCE_LABELS_FR: Record<string, string> = {
  organization: "Organisation",
  invitation: "Invitation",
  member: "Membre",
  team: "Équipe",
  ac: "Contrôle d'accès",
  branch: "Établissement",
  inscription: "Inscription",
  teacher: "Enseignant",
  parent: "Parent",
  personnel: "Personnel",
  schedule: "Horaire",
  student: "Élève",
  finance: "Finance",
  teaching: "Enseignement",
  attendance: "Présences",
  notes: "Notes",
  results: "Résultats",
  devoirs: "Devoirs",
  library: "Bibliothèque",
  fiches: "Fiches",
  documents: "Documents",
  settings: "Paramètres",
  candidatures: "Candidatures",
  platformSupport: "Support plateforme",
  organizationSupport: "Support établissement",
  platformEscalation: "Escalade support",
  user: "Utilisateur",
  session: "Session",
};

const ACTION_LABELS_FR: Record<string, string> = {
  create: "Créer",
  read: "Voir",
  update: "Modifier",
  delete: "Supprimer",
  share: "Partager",
  cancel: "Annuler",
  encaisser: "Encaisser",
  assign: "Affecter",
  close: "Clôturer",
  ban: "Bannir",
  impersonate: "Usurper",
  "set-password": "Définir mot de passe",
  "set-role": "Définir rôle",
  "list-users": "Lister utilisateurs",
};

export function resourceLabelFr(resource: string): string {
  return RESOURCE_LABELS_FR[resource] ?? resource;
}

export function actionLabelFr(action: string): string {
  return ACTION_LABELS_FR[action] ?? action;
}

/** Ex. `Finance · Encaisser` */
export function permissionLabelFr(resource: string, action: string): string {
  return `${resourceLabelFr(resource)} · ${actionLabelFr(action)}`;
}

export type PermissionMatrixGroup = {
  id: string;
  label: string;
  resources: string[];
};

/** Groupes UI matrice (P3). */
export const PERMISSION_MATRIX_GROUPS: PermissionMatrixGroup[] = [
  {
    id: "organisation",
    label: "Organisation",
    resources: ["organization", "invitation", "member", "team", "ac", "branch"],
  },
  {
    id: "etablissement",
    label: "Établissement",
    resources: ["settings", "candidatures", "organizationSupport"],
  },
  {
    id: "pedagogie",
    label: "Pédagogie",
    resources: [
      "inscription",
      "student",
      "teacher",
      "teaching",
      "schedule",
      "attendance",
      "notes",
      "results",
      "devoirs",
      "fiches",
      "documents",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    resources: ["finance"],
  },
  {
    id: "cursus",
    label: "Cursus",
    resources: ["library"],
  },
  {
    id: "rh",
    label: "RH",
    resources: ["personnel", "parent"],
  },
  {
    id: "admin",
    label: "Admin / support",
    resources: [
      "organizationSupport",
      "platformSupport",
      "platformEscalation",
    ],
  },
];

export function listCatalogPermissions(): Array<{
  resource: string;
  action: string;
  label: string;
}> {
  const out: Array<{ resource: string; action: string; label: string }> = [];
  for (const [resource, actions] of Object.entries(accessControlStatements)) {
    for (const action of actions) {
      out.push({
        resource,
        action: String(action),
        label: permissionLabelFr(resource, String(action)),
      });
    }
  }
  return out;
}
