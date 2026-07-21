import {
  getBranchCapabilities,
  hidesParentManagement,
  isAtelierBranch,
  isPrimaryBranch,
  requiresStudentImport,
  usesAttestationForBranch,
  usesBrevetForBranch,
  usesBulletinForBranch,
  usesFinanceForBranch,
  usesPonderationForBranch,
  usesReleveForBranch,
  usesSectionOptionForBranch,
} from "@/lib/branch-capabilities";
import { usesTrainingLabels } from "@/lib/training-labels";

export type BranchRouteRule = {
  /** Suffixe de route sous `/admin/.../branches/[branchId]`. */
  suffix: string;
  isAllowed: (typebranch: unknown) => boolean;
  /** Route de repli relative a la branche (ex. `/classe`). */
  redirectTo: string;
};

export const BRANCH_ROUTE_RULES: BranchRouteRule[] = [
  {
    suffix: "/section",
    isAllowed: usesSectionOptionForBranch,
    redirectTo: "/classe",
  },
  {
    suffix: "/option",
    isAllowed: usesSectionOptionForBranch,
    redirectTo: "/classe",
  },
  {
    suffix: "/fiches",
    isAllowed: usesBulletinForBranch,
    redirectTo: "/results",
  },
  {
    suffix: "/coursPonderationOption",
    isAllowed: usesPonderationForBranch,
    redirectTo: "/cours",
  },
  {
    suffix: "/registration",
    isAllowed: (typebranch) => !requiresStudentImport(typebranch),
    redirectTo: "/student",
  },
  {
    suffix: "/parent",
    isAllowed: (typebranch) => !hidesParentManagement(typebranch),
    redirectTo: "/student",
  },
  {
    suffix: "/attestations",
    isAllowed: usesAttestationForBranch,
    redirectTo: "/results",
  },
  {
    suffix: "/brevets",
    isAllowed: usesBrevetForBranch,
    redirectTo: "/results",
  },
  {
    suffix: "/programmes",
    isAllowed: usesSectionOptionForBranch,
    redirectTo: "/classe",
  },
  {
    suffix: "/modules",
    isAllowed: usesSectionOptionForBranch,
    redirectTo: "/classe",
  },
  {
    suffix: "/releves",
    isAllowed: usesReleveForBranch,
    redirectTo: "/results",
  },
];

const FINANCE_ROUTE_SUFFIXES = ["/frais", "/paiement"];

export function normalizeBranchRouteSuffix(pathname: string): string | null {
  const match = pathname.match(
    /\/admin\/organizations\/[^/]+\/branches\/[^/]+(\/[^?#]*)/,
  );
  return match?.[1] ?? null;
}

export function findBranchRouteRule(
  pathnameOrSuffix: string,
): BranchRouteRule | null {
  const suffix = pathnameOrSuffix.startsWith("/")
    ? normalizeBranchRouteSuffix(pathnameOrSuffix) ?? pathnameOrSuffix
    : pathnameOrSuffix;

  if (!suffix) return null;

  return (
    BRANCH_ROUTE_RULES.find(
      (rule) => suffix === rule.suffix || suffix.startsWith(`${rule.suffix}/`),
    ) ?? null
  );
}

export function isBranchRouteAllowed(
  pathnameOrSuffix: string,
  typebranch: unknown,
): boolean {
  const rule = findBranchRouteRule(pathnameOrSuffix);
  if (!rule) return true;
  return rule.isAllowed(typebranch);
}

export function getBranchRouteRedirect(
  pathnameOrSuffix: string,
  typebranch: unknown,
  organizationId: string,
  branchId: string,
): string | null {
  const rule = findBranchRouteRule(pathnameOrSuffix);
  if (!rule || rule.isAllowed(typebranch)) return null;

  return `/admin/organizations/${organizationId}/branches/${branchId}${rule.redirectTo}`;
}

export function isFinanceRouteAllowed(typebranch: unknown): boolean {
  return usesFinanceForBranch(typebranch);
}

export function shouldHideSidebarHref(
  href: string,
  typebranch: unknown,
): boolean {
  const normalizedHref = href.replace(/^\/admin/, "");

  if (
    (normalizedHref === "/section" || normalizedHref === "/option") &&
    !usesSectionOptionForBranch(typebranch)
  ) {
    return true;
  }

  if (normalizedHref === "/fiches" && !usesBulletinForBranch(typebranch)) {
    return true;
  }

  if (
    normalizedHref === "/coursPonderationOption" &&
    !usesPonderationForBranch(typebranch)
  ) {
    return true;
  }

  if (
    FINANCE_ROUTE_SUFFIXES.includes(normalizedHref) &&
    !usesFinanceForBranch(typebranch)
  ) {
    return true;
  }

  if (
    normalizedHref === "/settings/primary-domains" &&
    !isPrimaryBranch(typebranch)
  ) {
    return true;
  }

  if (normalizedHref === "/registration" && requiresStudentImport(typebranch)) {
    return true;
  }

  if (normalizedHref === "/parent" && hidesParentManagement(typebranch)) {
    return true;
  }

  if (normalizedHref === "/attestations" && !usesAttestationForBranch(typebranch)) {
    return true;
  }

  if (normalizedHref === "/brevets" && !usesBrevetForBranch(typebranch)) {
    return true;
  }

  if (normalizedHref === "/releves" && !usesReleveForBranch(typebranch)) {
    return true;
  }

  if (
    (normalizedHref === "/programmes" || normalizedHref === "/modules") &&
    !usesTrainingLabels(typebranch)
  ) {
    return true;
  }

  if (
    (normalizedHref === "/section" || normalizedHref === "/option") &&
    usesTrainingLabels(typebranch)
  ) {
    return true;
  }

  return false;
}

export function getBranchTypeDescription(typebranch: unknown): string {
  const caps = getBranchCapabilities(typebranch);

  switch (caps.typebranch) {
    case "PRIMAIRE":
      return "Ecole primaire avec bulletins trimestriels et domaines RDC.";
    case "SECONDAIRE":
      return "Ecole secondaire avec sections, options, classes et bulletins semestriels.";
    case "ATELIER":
      return "Formation pratique : importez eleves, enseignants et personnels depuis les autres branches de l'organisation. Les parents ne sont pas geres ici.";
    case "CENTRE_FORMATION":
      return "Formation certifiante avec programmes, sessions et emission de brevet. Les apprenants sont rattaches automatiquement a un parent systeme.";
    case "UNIVERSITE":
      return "Enseignement superieur : importez apprenants, cours, enseignants et personnels. Les parents sont renseignes uniquement a l'inscription.";
    default:
      return caps.label;
  }
}
