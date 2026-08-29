/**
 * Métadonnées seed des presets OrganizationRole (P2).
 * Les statements viennent de `organizationRoleStatements` (source code).
 */

import {
  ALL_ORG_ROLE_SLUGS,
  ORG_ROLE,
  organizationRoleStatements,
} from "@/lib/permissions";

export type OrgRolePresetMeta = {
  slug: string;
  label: string;
  description: string;
  isSystem: boolean;
  sortOrder: number;
  /** Owner : non éditable / non supprimable en UI. */
  locked: boolean;
};

const PRESET_META: Record<string, Omit<OrgRolePresetMeta, "slug">> = {
  [ORG_ROLE.OWNER]: {
    label: "Propriétaire",
    description: "Contrôle total de l'organisation (hors suppression plateforme).",
    isSystem: true,
    sortOrder: 0,
    locked: true,
  },
  [ORG_ROLE.GESTIONNAIRE]: {
    label: "Gestionnaire",
    description: "CRU métier + support ; pas de suppression physique.",
    isSystem: true,
    sortOrder: 10,
    locked: false,
  },
  [ORG_ROLE.AGENT_BUREAU]: {
    label: "Agent de bureau",
    description:
      "Comme le gestionnaire : tous les cycles et l'annuaire, sans finance ni notes.",
    isSystem: true,
    sortOrder: 15,
    locked: false,
  },
  [ORG_ROLE.PREFET]: {
    label: "Préfet",
    description: "Chef d'établissement (secondaire/humanités) — pédagogie + RH.",
    isSystem: true,
    sortOrder: 20,
    locked: false,
  },
  [ORG_ROLE.DIRECTEUR]: {
    label: "Directeur",
    description: "Chef d'établissement (primaire) — même matrice que préfet.",
    isSystem: true,
    sortOrder: 21,
    locked: false,
  },
  [ORG_ROLE.DIRECTEUR_ETUDES]: {
    label: "Directeur des études",
    description: "Pilotage pédagogique sans finance ; RH en lecture.",
    isSystem: true,
    sortOrder: 30,
    locked: false,
  },
  [ORG_ROLE.SUPERVISEUR]: {
    label: "Superviseur",
    description: "CRUD large sur les modules scolaires.",
    isSystem: true,
    sortOrder: 40,
    locked: false,
  },
  [ORG_ROLE.TEACHER]: {
    label: "Enseignant",
    description: "Notes, présences, devoirs, bibliothèque — scopes classes.",
    isSystem: true,
    sortOrder: 50,
    locked: false,
  },
  [ORG_ROLE.CAISSIER]: {
    label: "Caissier",
    description: "Paiements + inscriptions ; pas de notes ni RH write.",
    isSystem: true,
    sortOrder: 60,
    locked: false,
  },
  [ORG_ROLE.PARENT]: {
    label: "Parent",
    description: "Lecture scoped (enfants) — résultats.",
    isSystem: true,
    sortOrder: 70,
    locked: false,
  },
  [ORG_ROLE.STUDENT]: {
    label: "Élève",
    description: "Lecture scoped (soi) — résultats, devoirs, bibliothèque.",
    isSystem: true,
    sortOrder: 80,
    locked: false,
  },
  [ORG_ROLE.SUPPORT]: {
    label: "Support",
    description: "Tickets établissement ; pas finance ni notes.",
    isSystem: true,
    sortOrder: 90,
    locked: false,
  },
};

export function listOrgRolePresetMetas(): OrgRolePresetMeta[] {
  return ALL_ORG_ROLE_SLUGS.map((slug) => {
    const meta = PRESET_META[slug];
    if (!meta) {
      return {
        slug,
        label: slug,
        description: "",
        isSystem: true,
        sortOrder: 999,
        locked: false,
      };
    }
    return { slug, ...meta };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Statements JSON prêts pour upsert OrganizationRole.permission. */
export function getOrgRolePresetPermissionJson(slug: string): string {
  const statements = organizationRoleStatements[slug] ?? {};
  return JSON.stringify(statements);
}

export function getOrgRolePresetSeedRows() {
  return listOrgRolePresetMetas().map((meta) => ({
    ...meta,
    permission: getOrgRolePresetPermissionJson(meta.slug),
  }));
}
