export const ESCALATION_STATUS_LABELS = {
  OPEN: "Ouverte",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolue",
  CLOSED: "Fermée",
} as const;

export const ESCALATION_PRIORITY_LABELS = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
} as const;

export type EscalationStatus = keyof typeof ESCALATION_STATUS_LABELS;
export type EscalationPriority = keyof typeof ESCALATION_PRIORITY_LABELS;
