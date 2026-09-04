/**
 * Catalogue d'octroi temporaire aligné sur les menus / sous-menus branche.
 * « Tout le menu » explose en une ressource DAC par sous-menu.
 */

export const GRANT_GROUP_ALL = "__all__";

export type TemporaryGrantCatalogItem = {
  resource: string;
  label: string;
  /** Actions spécifiques (sinon CRUD + lecture accompagnante). */
  extraActions?: string[];
};

export type TemporaryGrantCatalogGroup = {
  id: string;
  label: string;
  items: TemporaryGrantCatalogItem[];
};

export const TEMPORARY_GRANT_CATALOG: TemporaryGrantCatalogGroup[] = [
  {
    id: "finance",
    label: "Finance",
    items: [
      { resource: "fees", label: "Frais" },
      {
        resource: "finance",
        label: "Paiement / Caisse",
        extraActions: ["encaisser"],
      },
      { resource: "payroll", label: "Paie du personnel" },
      { resource: "transactions", label: "Transactions" },
    ],
  },
  {
    id: "cursus",
    label: "Cursus",
    items: [
      { resource: "results", label: "Résultats" },
      { resource: "devoirs", label: "Devoirs" },
      { resource: "library", label: "Bibliothèque" },
      { resource: "notes", label: "Notes" },
      { resource: "ficheCentrale", label: "Fiche centrale" },
      { resource: "fiches", label: "Fiches" },
      { resource: "documents", label: "Attestations / Brevets / Relevés" },
      { resource: "finalistes", label: "Finalistes" },
    ],
  },
  {
    id: "teaching",
    label: "Enseignement",
    items: [
      { resource: "courses", label: "Cours" },
      { resource: "ponderations", label: "Pondérations" },
      { resource: "teaching", label: "Affectations" },
      { resource: "vacation", label: "Vacations" },
      { resource: "schedule", label: "Horaire" },
    ],
  },
  {
    id: "users",
    label: "Utilisateurs",
    items: [
      { resource: "student", label: "Élèves" },
      { resource: "personnel", label: "Personnel" },
      { resource: "teacher", label: "Enseignants" },
      { resource: "parent", label: "Parents" },
    ],
  },
  {
    id: "classes",
    label: "Classes & structure",
    items: [
      { resource: "sections", label: "Sections" },
      { resource: "options", label: "Options" },
      { resource: "classe", label: "Classes" },
    ],
  },
  {
    id: "settings",
    label: "Paramètres",
    items: [
      { resource: "ac", label: "Rôles & privilèges" },
      { resource: "feeTypes", label: "Types de frais" },
      { resource: "exchangeRates", label: "Taux de change" },
      { resource: "settings", label: "WhatsApp / Messagerie / Bibliothèque" },
      { resource: "publicCommunication", label: "Communication publique" },
      { resource: "schoolCalendar", label: "Calendrier scolaire" },
      { resource: "schoolYear", label: "Année scolaire" },
      { resource: "periods", label: "Périodes" },
      { resource: "structureCopy", label: "Copier la structure" },
      { resource: "organizationSupport", label: "Support établissement" },
    ],
  },
  {
    id: "standalone",
    label: "Autres menus",
    items: [
      { resource: "inscription", label: "Inscriptions" },
      { resource: "candidatures", label: "Candidatures" },
      { resource: "attendance", label: "Présences" },
      { resource: "messaging", label: "Messagerie interne" },
    ],
  },
];

const ALL_RESOURCES = new Set(
  TEMPORARY_GRANT_CATALOG.flatMap((group) =>
    group.items.map((item) => item.resource),
  ),
);

export function findGrantCatalogGroup(groupId: string) {
  return TEMPORARY_GRANT_CATALOG.find((group) => group.id === groupId) ?? null;
}

export function isCatalogGrantResource(resource: string) {
  return ALL_RESOURCES.has(resource);
}

export function extraActionsForResource(resource: string) {
  for (const group of TEMPORARY_GRANT_CATALOG) {
    const item = group.items.find((entry) => entry.resource === resource);
    if (item?.extraActions?.length) return item.extraActions;
  }
  return [];
}

/**
 * Résout la sélection UI en ressources DAC à octroyer.
 * `GRANT_GROUP_ALL` = tous les sous-menus du groupe.
 * Un tableau de ressources = sélection multiple.
 */
export function resolveTemporaryGrantResources(
  groupId: string,
  itemValue: string | string[],
): string[] {
  const group = findGrantCatalogGroup(groupId);
  if (!group) return [];

  const values = (Array.isArray(itemValue) ? itemValue : [itemValue]).filter(
    Boolean,
  );
  if (values.includes(GRANT_GROUP_ALL)) {
    return group.items.map((item) => item.resource);
  }

  const allowed = new Set(group.items.map((item) => item.resource));
  return [...new Set(values.filter((value) => allowed.has(value)))];
}

const ALLOWED_GRANT_ACTIONS = new Set([
  "read",
  "create",
  "update",
  "delete",
  "encaisser",
]);

export function isAllowedGrantAction(action: string) {
  return ALLOWED_GRANT_ACTIONS.has(action.trim().toLowerCase());
}

/** Paires ressource/action à persister (encaisser uniquement sur le paiement). */
export function buildTemporaryGrantPairs(
  resources: string[],
  actions: string[],
): Array<{ resource: string; action: string }> {
  const pairs: Array<{ resource: string; action: string }> = [];
  for (const resource of resources) {
    for (const action of actions) {
      if (
        action === "encaisser" &&
        !extraActionsForResource(resource).includes("encaisser")
      ) {
        continue;
      }
      pairs.push({ resource, action });
    }
  }
  return pairs;
}
