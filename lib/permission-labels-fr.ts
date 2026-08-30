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
  ac: "Rôles & privilèges",
  branch: "Établissement",
  inscription: "Inscription",
  teacher: "Enseignant",
  parent: "Parent",
  personnel: "Personnel",
  schedule: "Horaire",
  student: "Élève",
  finance: "Paiement",
  fees: "Frais",
  feeTypes: "Types de frais",
  exchangeRates: "Taux de change",
  teaching: "Affectations",
  attendance: "Présences",
  notes: "Notes",
  results: "Résultats",
  devoirs: "Devoirs",
  library: "Bibliothèque",
  fiches: "Fiches",
  ficheCentrale: "Fiche centrale",
  finalistes: "Liste finalistes",
  documents: "Documents",
  courses: "Cours",
  ponderations: "Pondérations",
  vacation: "Vacation",
  sections: "Sections",
  options: "Options",
  classe: "Classe",
  publicCommunication: "Communication publique",
  schoolCalendar: "Calendrier scolaire",
  schoolYear: "Année scolaire",
  periods: "Périodes",
  structureCopy: "Copier la structure",
  settings: "Paramètres",
  candidatures: "Candidatures",
  platformSupport: "Support plateforme",
  organizationSupport: "Support",
  platformEscalation: "Escalade support",
  messaging: "Messagerie",
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
  send: "Envoyer",
  group: "Groupe",
  manage: "Gérer",
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
    resources: ["organization", "invitation", "member", "ac", "branch"],
  },
  {
    id: "parametres",
    label: "Paramètres établissement",
    resources: [
      "feeTypes",
      "exchangeRates",
      "publicCommunication",
      "schoolCalendar",
      "schoolYear",
      "periods",
      "attendance",
      "structureCopy",
      "organizationSupport",
      "settings",
      "candidatures",
    ],
  },
  {
    id: "enseignement",
    label: "Enseignement",
    resources: [
      "courses",
      "ponderations",
      "teaching",
      "vacation",
      "schedule",
    ],
  },
  {
    id: "structure",
    label: "Structure scolaire",
    resources: ["sections", "options", "classe"],
  },
  {
    id: "pedagogie",
    label: "Pédagogie & cursus",
    resources: [
      "inscription",
      "student",
      "teacher",
      "notes",
      "results",
      "devoirs",
      "library",
      "fiches",
      "ficheCentrale",
      "finalistes",
      "documents",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    resources: ["fees", "finance"],
  },
  {
    id: "rh",
    label: "RH",
    resources: ["personnel", "parent"],
  },
  {
    id: "admin",
    label: "Admin / support",
    resources: ["platformSupport", "platformEscalation"],
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
