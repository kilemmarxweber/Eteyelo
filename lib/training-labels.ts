import { normalizeBranchType, type ManagedBranchType } from "@/lib/academic-structure";

type TrainingLabels = {
  sectionTitle: string;
  sectionDescription: string;
  sectionBadge: string;
  sectionCreate: string;
  optionTitle: string;
  optionDescription: string;
  optionBadge: string;
  optionCreate: string;
  programmesMenu: string;
  modulesMenu: string;
};

const DEFAULT_LABELS: TrainingLabels = {
  sectionTitle: "Liste des sections",
  sectionDescription: "Organisez les sections disponibles pour les classes secondaires.",
  sectionBadge: "Sections",
  sectionCreate: "Creer une section",
  optionTitle: "Liste des options",
  optionDescription: "Definissez les options rattachees aux sections.",
  optionBadge: "Options",
  optionCreate: "Creer une option",
  programmesMenu: "Sections",
  modulesMenu: "Options",
};

const CENTRE_LABELS: TrainingLabels = {
  sectionTitle: "Programmes de formation",
  sectionDescription:
    "Organisez les familles de programmes proposés par le centre.",
  sectionBadge: "Programmes",
  sectionCreate: "Creer un programme",
  optionTitle: "Modules de formation",
  optionDescription: "Definissez les modules rattaches a chaque programme.",
  optionBadge: "Modules",
  optionCreate: "Creer un module",
  programmesMenu: "Programmes",
  modulesMenu: "Modules",
};

const UNIVERSITY_LABELS: TrainingLabels = {
  sectionTitle: "Facultes",
  sectionDescription: "Organisez les facultes de l'etablissement.",
  sectionBadge: "Facultes",
  sectionCreate: "Creer une faculte",
  optionTitle: "Filieres",
  optionDescription: "Definissez les filieres rattachees aux facultes.",
  optionBadge: "Filieres",
  optionCreate: "Creer une filiere",
  programmesMenu: "Facultes",
  modulesMenu: "Filieres",
};

export function getTrainingLabels(typebranch: unknown): TrainingLabels {
  const normalized = normalizeBranchType(typebranch) as ManagedBranchType;

  switch (normalized) {
    case "CENTRE_FORMATION":
      return CENTRE_LABELS;
    case "UNIVERSITE":
      return UNIVERSITY_LABELS;
    default:
      return DEFAULT_LABELS;
  }
}

export function usesTrainingLabels(typebranch: unknown): boolean {
  const normalized = normalizeBranchType(typebranch);
  return normalized === "CENTRE_FORMATION" || normalized === "UNIVERSITE";
}
