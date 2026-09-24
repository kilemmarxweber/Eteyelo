/** Catalogue des domaines pratiques atelier (distinct du bulletin primaire). */

export const PRACTICAL_DOMAIN_CODES = [
  "SCIENCES",
  "TECHNIQUE",
  "COMPTABILITE",
] as const;

export type PracticalDomainCode = (typeof PRACTICAL_DOMAIN_CODES)[number];

export const PRACTICAL_DOMAIN_CATALOG: ReadonlyArray<{
  code: PracticalDomainCode;
  name: string;
  sortOrder: number;
  /** Salle système créée avec le domaine (Sciences → Labo). */
  defaultRoomName?: string;
}> = [
  {
    code: "SCIENCES",
    name: "Domaine des sciences",
    sortOrder: 0,
    defaultRoomName: "Laboratoire sciences",
  },
  {
    code: "TECHNIQUE",
    name: "Domaine technique",
    sortOrder: 1,
  },
  {
    code: "COMPTABILITE",
    name: "Domaine de la comptabilité",
    sortOrder: 2,
  },
];

export function isPracticalDomainCode(
  value: unknown,
): value is PracticalDomainCode {
  return (
    typeof value === "string" &&
    (PRACTICAL_DOMAIN_CODES as readonly string[]).includes(value)
  );
}
