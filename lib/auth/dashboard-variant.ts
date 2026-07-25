import {
  canAccessFinanceArea,
  canManageOrganization,
  hasSessionRole,
  isDirecteurEtudesRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";

/**
 * Variantes du dashboard branche (unit-00 §3bis / unit-03b).
 * Une seule route `/[branchId]` ; le contenu dépend du rôle session.
 *
 * `directeur` = chef d’établissement (préfet/directeur) — pilotage + finance.
 * `prefet` = alias historique de la variante pédagogique (directeur des études).
 */
export type DashboardVariant =
  | "directeur"
  | "prefet"
  | "directeur_etudes"
  | "teacher"
  | "caissier"
  | "student"
  | "parent"
  | "minimal";

/**
 * Résout la variante dashboard depuis la session.
 * Priorité : chef école (finance) → directeur des études → métier branche.
 */
export function resolveDashboardVariant(session: any): DashboardVariant {
  if (canManageOrganization(session)) {
    if (canAccessFinanceArea(session)) return "directeur";
    if (isDirecteurEtudesRole(session)) return "directeur_etudes";
    return "prefet";
  }

  if (
    hasSessionRole(session, [
      ORG_ROLE.CAISSIER,
      "CAISSIER",
      "ACCOUNTANT",
      "accountant",
    ])
  ) {
    return "caissier";
  }

  if (hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER", "teacher"])) {
    return "teacher";
  }

  if (hasSessionRole(session, [ORG_ROLE.STUDENT, "STUDENT", "student"])) {
    return "student";
  }

  if (hasSessionRole(session, [ORG_ROLE.PARENT, "PARENT", "parent"])) {
    return "parent";
  }

  return "minimal";
}

/** Blocs de données autorisés pour une variante (pas seulement UI). */
export type DashboardDataBlocks = {
  schoolStats: boolean;
  revenue: boolean;
  pedagogyMetrics: boolean;
  events: boolean;
  cashier: boolean;
  teacher: boolean;
  student: boolean;
  parent: boolean;
  parentFeedback: boolean;
};

const PEDAGOGY_SCHOOL_BLOCKS: DashboardDataBlocks = {
  schoolStats: true,
  revenue: false,
  pedagogyMetrics: true,
  events: true,
  cashier: false,
  teacher: false,
  student: false,
  parent: false,
  parentFeedback: false,
};

export function getDashboardDataBlocks(
  variant: DashboardVariant,
): DashboardDataBlocks {
  switch (variant) {
    case "directeur":
      return {
        schoolStats: true,
        revenue: true,
        pedagogyMetrics: true,
        events: true,
        cashier: false,
        teacher: false,
        student: false,
        parent: false,
        parentFeedback: false,
      };
    case "directeur_etudes":
    case "prefet":
      return { ...PEDAGOGY_SCHOOL_BLOCKS };
    case "teacher":
      return {
        schoolStats: false,
        revenue: false,
        pedagogyMetrics: false,
        events: true,
        cashier: false,
        teacher: true,
        student: false,
        parent: false,
        parentFeedback: false,
      };
    case "caissier":
      return {
        schoolStats: false,
        revenue: false,
        pedagogyMetrics: false,
        events: true,
        cashier: true,
        teacher: false,
        student: false,
        parent: false,
        parentFeedback: false,
      };
    case "student":
      return {
        schoolStats: false,
        revenue: false,
        pedagogyMetrics: false,
        events: true,
        cashier: false,
        teacher: false,
        student: true,
        parent: false,
        parentFeedback: false,
      };
    case "parent":
      return {
        schoolStats: false,
        revenue: false,
        pedagogyMetrics: false,
        events: true,
        cashier: false,
        teacher: false,
        student: false,
        parent: true,
        parentFeedback: true,
      };
    case "minimal":
    default:
      return {
        schoolStats: false,
        revenue: false,
        pedagogyMetrics: false,
        events: true,
        cashier: false,
        teacher: false,
        student: false,
        parent: false,
        parentFeedback: false,
      };
  }
}

export function canAccessSchoolAdminMetrics(session: any): boolean {
  const variant = resolveDashboardVariant(session);
  const blocks = getDashboardDataBlocks(variant);
  return blocks.schoolStats || blocks.pedagogyMetrics;
}
