import { normalizeBranchType, type ManagedBranchType } from "@/lib/academic-structure";
import { usesBulletinForBranch } from "@/lib/branch-capabilities";
import { isSchoolCycle } from "@/lib/cycle";
import { getBranchTypeDescription } from "@/lib/branch-route-guard";

export type RegistrationFormLabels = {
  badge: string;
  titleRequest: string;
  titleCreate: string;
  descriptionRequest: string;
  descriptionCreate: string;
  benefit1Request: string;
  benefit1Create: string;
  benefit2Request: string;
  benefit2Create: string;
  sectionTitle: string;
  sectionDescriptionRequest: string;
  sectionDescriptionCreate: string;
  nameLabel: string;
  namePlaceholder: string;
  codeLabel: string;
  typeLabel: string;
  typeDescription: string;
  mapTitle: string;
  mapDescription: string;
  mapBenefit1: string;
  mapBenefit2: string;
  submitRequest: string;
  submitCreate: string;
};

type EstablishmentWording = {
  badgePrefix: string;
  titleRequest: string;
  titleCreate: string;
  descriptionRequest: string;
  descriptionCreate: string;
  sectionTitle: string;
  sectionDescriptionRequest: string;
  nameLabel: string;
  namePlaceholder: string;
  mapTitle: string;
  mapDescription: string;
  submitCreate: string;
  locationAudience: string;
};

const ESTABLISHMENT_WORDING: Record<ManagedBranchType, EstablishmentWording> = {
  PRIMAIRE: {
    badgePrefix: "école primaire",
    titleRequest: "Demandez l'inscription de votre école primaire",
    titleCreate: "Ajoutez votre école primaire",
    descriptionRequest:
      "Remplissez le formulaire avec les informations de votre école. Klambocore examinera votre demande avant publication sur la plateforme.",
    descriptionCreate:
      "Créez la fiche de votre école, indiquez ses coordonnées et positionnez-la sur la carte pour faciliter la recherche locale.",
    sectionTitle: "Informations de l'école",
    sectionDescriptionRequest:
      "Renseignez les informations de votre école pour votre demande.",
    nameLabel: "Nom de l'école",
    namePlaceholder: "Nom de l'école *",
    mapTitle: "Emplacement de l'école",
    mapDescription:
      "Cliquez sur la carte pour pointer l'emplacement exact de l'école.",
    submitCreate: "Créer l'école",
    locationAudience: "les élèves et les parents",
  },
  SECONDAIRE: {
    badgePrefix: "école secondaire",
    titleRequest: "Demandez l'inscription de votre école secondaire",
    titleCreate: "Ajoutez votre école secondaire",
    descriptionRequest:
      "Remplissez le formulaire avec les informations de votre école. Klambocore examinera votre demande avant publication sur la plateforme.",
    descriptionCreate:
      "Créez la fiche de votre école, indiquez ses coordonnées et positionnez-la sur la carte pour faciliter la recherche locale.",
    sectionTitle: "Informations de l'école",
    sectionDescriptionRequest:
      "Renseignez les informations de votre école pour votre demande.",
    nameLabel: "Nom de l'école",
    namePlaceholder: "Nom de l'école *",
    mapTitle: "Emplacement de l'école",
    mapDescription:
      "Cliquez sur la carte pour pointer l'emplacement exact de l'école.",
    submitCreate: "Créer l'école",
    locationAudience: "les élèves et les parents",
  },
  UNIVERSITE: {
    badgePrefix: "université",
    titleRequest: "Demandez l'inscription de votre université",
    titleCreate: "Ajoutez votre université",
    descriptionRequest:
      "Remplissez le formulaire avec les informations de votre université. Klambocore examinera votre demande avant publication sur la plateforme.",
    descriptionCreate:
      "Créez la fiche de votre université, indiquez ses coordonnées et positionnez-la sur la carte pour faciliter la recherche locale.",
    sectionTitle: "Informations de l'université",
    sectionDescriptionRequest:
      "Renseignez les informations de votre université pour votre demande.",
    nameLabel: "Nom de l'université",
    namePlaceholder: "Nom de l'université *",
    mapTitle: "Emplacement de l'université",
    mapDescription:
      "Cliquez sur la carte pour pointer l'emplacement exact de l'université.",
    submitCreate: "Créer l'université",
    locationAudience: "les étudiants",
  },
  CENTRE_FORMATION: {
    badgePrefix: "centre de formation",
    titleRequest: "Demandez l'inscription de votre centre de formation",
    titleCreate: "Ajoutez votre centre de formation",
    descriptionRequest:
      "Remplissez le formulaire avec les informations de votre centre. Klambocore examinera votre demande avant publication sur la plateforme.",
    descriptionCreate:
      "Créez la fiche de votre centre, indiquez ses coordonnées et positionnez-le sur la carte pour faciliter la recherche locale.",
    sectionTitle: "Informations du centre",
    sectionDescriptionRequest:
      "Renseignez les informations de votre centre pour votre demande.",
    nameLabel: "Nom du centre",
    namePlaceholder: "Nom du centre *",
    mapTitle: "Emplacement du centre",
    mapDescription:
      "Cliquez sur la carte pour pointer l'emplacement exact du centre.",
    submitCreate: "Créer le centre",
    locationAudience: "les apprenants",
  },
  ATELIER: {
    badgePrefix: "atelier",
    titleRequest: "Demandez l'inscription de votre atelier",
    titleCreate: "Ajoutez votre atelier",
    descriptionRequest:
      "Remplissez le formulaire avec les informations de votre atelier. Klambocore examinera votre demande avant publication sur la plateforme.",
    descriptionCreate:
      "Créez la fiche de votre atelier, indiquez ses coordonnées et positionnez-le sur la carte pour faciliter la recherche locale.",
    sectionTitle: "Informations de l'atelier",
    sectionDescriptionRequest:
      "Renseignez les informations de votre atelier pour votre demande.",
    nameLabel: "Nom de l'atelier",
    namePlaceholder: "Nom de l'atelier *",
    mapTitle: "Emplacement de l'atelier",
    mapDescription:
      "Cliquez sur la carte pour pointer l'emplacement exact de l'atelier.",
    submitCreate: "Créer l'atelier",
    locationAudience: "les participants",
  },
};

const MATERNELLE_WORDING: EstablishmentWording = {
  badgePrefix: "école maternelle",
  titleRequest: "Demandez l'inscription de votre école maternelle",
  titleCreate: "Ajoutez votre école maternelle",
  descriptionRequest:
    "Remplissez le formulaire avec les informations de votre école. Klambocore examinera votre demande avant publication sur la plateforme.",
  descriptionCreate:
    "Créez la fiche de votre école maternelle, indiquez ses coordonnées et positionnez-la sur la carte.",
  sectionTitle: "Informations de l'école",
  sectionDescriptionRequest:
    "Renseignez les informations de votre école pour votre demande.",
  nameLabel: "Nom de l'école",
  namePlaceholder: "Nom de l'école *",
  mapTitle: "Emplacement de l'école",
  mapDescription:
    "Cliquez sur la carte pour pointer l'emplacement exact de l'école.",
  submitCreate: "Créer l'école",
  locationAudience: "les enfants et les parents",
};

const COMBINED_SCHOOL_WORDING: EstablishmentWording = {
  badgePrefix: "école",
  titleRequest: "Demandez l'inscription de votre école",
  titleCreate: "Ajoutez votre école",
  descriptionRequest:
    "Remplissez le formulaire avec les informations de votre école. Klambocore examinera votre demande avant publication sur la plateforme.",
  descriptionCreate:
    "Créez une seule fiche pour maternelle, primaire et/ou secondaire : caisse et année scolaire communes.",
  sectionTitle: "Informations de l'école",
  sectionDescriptionRequest:
    "Renseignez les informations de votre école pour votre demande.",
  nameLabel: "Nom de l'école",
  namePlaceholder: "Nom de l'école *",
  mapTitle: "Emplacement de l'école",
  mapDescription:
    "Cliquez sur la carte pour pointer l'emplacement exact de l'école.",
  submitCreate: "Créer l'école",
  locationAudience: "les élèves et les parents",
};

export function getRegistrationFormLabels(
  typebranch: unknown,
  schoolCycles?: readonly string[],
): RegistrationFormLabels {
  const school = (schoolCycles ?? []).filter(isSchoolCycle);
  const wording =
    school.length > 1
      ? COMBINED_SCHOOL_WORDING
      : school[0] === "MATERNELLE"
        ? MATERNELLE_WORDING
        : ESTABLISHMENT_WORDING[normalizeBranchType(typebranch)];
  const codeLabel = usesBulletinForBranch(
    school[0] === "MATERNELLE" ? "MATERNELLE" : normalizeBranchType(typebranch),
  )
    ? "Code école (bulletin)"
    : "Code établissement (optionnel)";

  const typeDescription =
    school.length > 1
      ? "Une caisse et une année scolaire communes. Calendriers, classes et bulletins distincts par cycle."
      : school[0] === "MATERNELLE"
        ? "École maternelle : 4 niveaux (Crèche, 1è, 2è, 3è), calendrier à 9 évaluations et bulletin de type primaire."
        : getBranchTypeDescription(normalizeBranchType(typebranch));

  return {
    badge: `Inscription ${wording.badgePrefix}`,
    titleRequest: wording.titleRequest,
    titleCreate: wording.titleCreate,
    descriptionRequest: wording.descriptionRequest,
    descriptionCreate: wording.descriptionCreate,
    benefit1Request:
      "Votre demande sera transmise à Klambocore pour examen.",
    benefit1Create: "Une fiche claire pour présenter votre établissement.",
    benefit2Request:
      "Indiquez une localisation précise pour faciliter la validation.",
    benefit2Create: `Une localisation précise pour ${wording.locationAudience}.`,
    sectionTitle: wording.sectionTitle,
    sectionDescriptionRequest: wording.sectionDescriptionRequest,
    sectionDescriptionCreate:
      "Les champs essentiels permettent de créer la fiche de base.",
    nameLabel: wording.nameLabel,
    namePlaceholder: wording.namePlaceholder,
    codeLabel,
    typeLabel: "Type d'établissement",
    typeDescription,
    mapTitle: wording.mapTitle,
    mapDescription: wording.mapDescription,
    mapBenefit1: "Une fiche claire pour présenter votre établissement.",
    mapBenefit2: `Une localisation précise pour ${wording.locationAudience}.`,
    submitRequest: "Envoyer la demande",
    submitCreate: wording.submitCreate,
  };
}
