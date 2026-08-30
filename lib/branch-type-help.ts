import { getBranchCapabilities } from "@/lib/branch-capabilities";
import { getBranchTypeDescription } from "@/lib/branch-route-guard";
import { getTrainingLabels } from "@/lib/training-labels";
import { getClassDisplayLabelPlural } from "@/lib/branch-capabilities";
import { getPeopleLabels } from "@/lib/people-labels";
import { normalizeBranchType } from "@/lib/academic-structure";

export type BranchHelpSection = {
  title: string;
  items: string[];
};

export type RegistrationManualStep = {
  step: number;
  title: string;
  description: string;
  tips?: string[];
};

export type RegistrationManualContent = {
  title: string;
  intro: string;
  modes: Array<{
    title: string;
    badge: string;
    description: string;
    highlights: string[];
  }>;
  counterTitle: string;
  counterIntro: string;
  steps: RegistrationManualStep[];
  /** Note en bas des 4 étapes (ex. brouillon). */
  footnote?: string;
};

export type BranchTypeHelpContent = {
  typeLabel: string;
  summary: string;
  sections: BranchHelpSection[];
  quickLinks: Array<{ label: string; href: string }>;
  /** Manuel d'inscription (primaire / secondaire). */
  registrationManual?: RegistrationManualContent;
};

const SCHOOL_REGISTRATION_MANUAL: RegistrationManualContent = {
  title: "Manuel d'inscription",
  intro:
    "Kalasa propose deux façons d'inscrire un élève : en ligne (demande validée ensuite par l'école) ou au guichet, directement à l'établissement.",
  modes: [
    {
      title: "Inscription en ligne",
      badge: "Parents & tuteurs",
      description:
        "Le parent ou le tuteur remplit lui-même les informations de l'enfant. L'école reçoit une notification de la demande, puis contacte les familles qui ne se sont pas encore présentées après leur inscription en ligne.",
      highlights: [
        "Gain de temps pour les agents recruteurs : moins de saisie manuelle.",
        "Les données essentielles sont déjà fournies côté parent ou tuteur.",
        "L'école valide la demande après réception et suivi.",
      ],
    },
    {
      title: "Inscription au guichet",
      badge: "À l'école",
      description:
        "Sur le menu de gauche, ouvrez Inscription. Vous verrez quatre étapes à compléter pour un nouvel élève.",
      highlights: [
        "Idéal lorsque l'élève et le parent sont présents à l'école.",
        "Parcours guidé en 4 étapes jusqu'à la confirmation.",
        "Possibilité de créer une classe si elle n'existe pas encore.",
      ],
    },
  ],
  counterTitle: "Inscription au guichet — les 4 étapes",
  counterIntro:
    "Menu de gauche → Inscription. Remplissez chaque étape avec soin ; vous pourrez revenir en arrière pour corriger avant la confirmation.",
  steps: [
    {
      step: 1,
      title: "Identité de l'élève",
      description:
        "Renseignez toutes les informations d'identité de l'élève sur le formulaire. La photo n'est pas obligatoire au départ ; si l'élève est présent, privilégiez une photo en uniforme scolaire. Lorsque tout est complet, cliquez sur Continuer.",
      tips: [
        "Photo facultative dans un premier temps.",
        "Uniforme recommandé si vous photographiez sur place.",
      ],
    },
    {
      step: 2,
      title: "Parent / tuteur",
      description:
        "Choisissez « Nouveau parent / tuteur » pour créer le responsable, ou « Parent existant » pour lier l'élève à un parent déjà enregistré dans l'établissement. Pour le premier enfant : inscrivez l'élève, renseignez le parent et sa classe. Pour un deuxième enfant (ou plus) du même parent : sélectionnez « Parent existant », recherchez le responsable et cliquez dessus pour le lier au nouvel élève — le système peut aussi le proposer automatiquement. Le bouton « Ajouter autres infos » en haut de l'étape est important pour compléter la fiche Dinacop (nationalité, nom de la mère, origines — province, territoire, secteur, village — tuteur, langue, etc.) ; vous pouvez le faire maintenant ou plus tard. La remise familiale se saisit à l'étape Classe, juste après le choix du niveau.",
      tips: [
        "2e enfant : cocher « Parent existant » et sélectionner le responsable.",
        "« Ajouter autres infos » : données Dinacop (origines, mère, tuteur…).",
        "Remise : à l'étape Classe, après la sélection de la classe.",
      ],
    },
    {
      step: 3,
      title: "Classe et provenance",
      description:
        "Choisissez le niveau demandé (classe) signalé par le parent, ainsi que l'école de provenance de l'élève. Si la classe n'existe pas pour ce niveau, le système propose d'en créer une : sélectionnez le niveau, choisissez la vacation de la classe, puis cliquez sur Créer la classe. Indiquez la capacité (gardez la valeur par défaut ou augmentez-la). Après le choix de la classe, saisissez éventuellement une remise en % : le montant est calculé sur le total des frais actifs du type choisi. Puis cliquez sur Continuer.",
      tips: [
        "Création de classe : Niveau → vacation → Créer la classe.",
        "Capacité : valeur par défaut acceptable au départ.",
        "Remise : % + type de frais, juste après la sélection de la classe.",
      ],
    },
    {
      step: 4,
      title: "Confirmation",
      description:
        "Relisez sommairement les informations avec le parent pour vérifier qu'elles sont exactes, puis confirmez. En cas d'erreur, utilisez Précédent pour corriger. Le système peut aussi signaler une erreur de saisie à corriger avant validation.",
      tips: [
        "Lecture à voix haute utile avec le parent.",
        "Précédent pour modifier ; le système valide aussi la saisie.",
      ],
    },
  ],
  footnote:
    "N.B. — Pendant la saisie, le système enregistre automatiquement un brouillon local. En cas de fermeture brusque de la page ou d'un clic involontaire, vos informations restent disponibles. Le badge « Brouillon local · [heure] » (à côté de Progression) indique la dernière sauvegarde. Les données ne disparaissent que lorsque vous les retirez vous-même en cliquant sur ce badge.",
};

export function getBranchTypeHelpContent(typebranch: unknown): BranchTypeHelpContent {
  const caps = getBranchCapabilities(typebranch);
  const labels = getTrainingLabels(typebranch);
  const classLabelPlural = getClassDisplayLabelPlural(typebranch);
  const peopleLabels = getPeopleLabels(typebranch);
  const normalized = normalizeBranchType(typebranch);

  switch (normalized) {
    case "ATELIER":
      return {
        typeLabel: caps.label,
        summary: getBranchTypeDescription(typebranch),
        sections: [
          {
            title: "Parcours recommande",
            items: [
              "1. Importer ou creer les enseignants et le personnel depuis les autres branches.",
              "2. Importer un eleve depuis une branche scolaire (primaire ou secondaire).",
              "3. Inscrire l'eleve a un groupe atelier via ClassEnrollment.",
              "4. Emettre une attestation de participation (apercu PDF + impression).",
            ],
          },
          {
            title: "Bon a savoir",
            items: [
              "La creation directe d'eleves est desactivee : import obligatoire.",
              "Les bulletins scolaires et la finance ne sont pas disponibles.",
              "L'archivage d'un eleve importe le retire de l'atelier sans supprimer son dossier scolaire.",
            ],
          },
        ],
        quickLinks: [
          { label: peopleLabels.studentPlural, href: "/admin/student" },
          { label: "Groupes", href: "/admin/classe" },
          { label: "Attestations", href: "/admin/attestations" },
        ],
      };

    case "CENTRE_FORMATION":
      return {
        typeLabel: caps.label,
        summary: getBranchTypeDescription(typebranch),
        sections: [
          {
            title: "Parcours recommande",
            items: [
              "1. Configurer les programmes et modules (sections/options renommees).",
              "2. Creer ou importer des apprenants.",
              "3. Inscrire les apprenants a une session active.",
              "4. Saisir les notes par module via les fiches de cotes.",
              "5. Emettre le brevet de formation (apercu PDF + enregistrement optionnel).",
            ],
          },
          {
            title: "Bon a savoir",
            items: [
              "Les ponderations servent de credits pour les evaluations.",
              "Un brevet peut etre emis par programme et session pour chaque apprenant.",
              "Les apprenants importes restent rattaches a leur branche d'origine.",
            ],
          },
        ],
        quickLinks: [
          { label: labels.programmesMenu, href: "/admin/programmes" },
          { label: labels.modulesMenu, href: "/admin/modules" },
          { label: "Sessions", href: "/admin/classe" },
          { label: "Brevets", href: "/admin/brevets" },
        ],
      };

    case "UNIVERSITE":
      return {
        typeLabel: caps.label,
        summary: getBranchTypeDescription(typebranch),
        sections: [
          {
            title: "Parcours recommande",
            items: [
              "1. Organiser facultes, filieres et auditoires.",
              "2. Creer ou importer des etudiants (avec auditoire obligatoire a l'import).",
              "3. Importer ou creer les cours, puis configurer les ponderations par filiere.",
              "4. Saisir les notes via fiches / fiche centrale (comme le secondaire).",
              "5. Generer un releve de notes semestriel ou annuel.",
              "6. Emettre des attestations (inscription, assiduite, reussite semestrielle).",
            ],
          },
          {
            title: "Bon a savoir",
            items: [
              "Les bulletins scolaires sont remplaces par les releves de notes.",
              "Calendrier LMD : annee academique en 2 semestres (S1-S16 selon le niveau).",
              "Periodes par semestre : Cours et Evaluations ; Premiere session au 1er semestre, Deuxieme session au 2e semestre.",
              "Les credits proviennent des ponderations cours/filiere.",
              "Les parents ne sont pas geres ici : ils sont renseignes uniquement a l'inscription.",
              "Les releves et attestations supportent apercu, impression et stockage PDF.",
            ],
          },
        ],
        quickLinks: [
          { label: labels.programmesMenu, href: "/admin/programmes" },
          { label: labels.modulesMenu, href: "/admin/modules" },
          { label: classLabelPlural, href: "/admin/classe" },
          { label: peopleLabels.studentPlural, href: "/admin/student" },
          { label: peopleLabels.teacherPlural, href: "/admin/teacher" },
          { label: "Releves", href: "/admin/releves" },
          { label: "Attestations", href: "/admin/attestations" },
        ],
      };

    case "PRIMAIRE":
      return {
        typeLabel: caps.label,
        summary: getBranchTypeDescription(typebranch),
        sections: [
          {
            title: "Fonctionnalites principales",
            items: [
              "Classes primaires avec bulletins trimestriels.",
              "Domaines RDC, fiches centrales et ponderations des cours.",
              "Inscription, finance et paiements disponibles.",
            ],
          },
          {
            title: "Bon a savoir",
            items: [
              "Les ponderations sont definies par niveau (1è–6è).",
              "La ponderation definit le maximum periode (ponderation x 10).",
              "Les demi-unites sont autorisees (ex. 0,5 → max 5) pour le catalogue RDC.",
            ],
          },
        ],
        quickLinks: [
          { label: "Classes", href: "/admin/classe" },
          { label: "Cours", href: "/admin/cours" },
          { label: "Ponderations", href: "/admin/coursPonderationOption" },
          { label: "Fiches", href: "/admin/fiches" },
          { label: "Inscription", href: "/admin/registration" },
        ],
        registrationManual: SCHOOL_REGISTRATION_MANUAL,
      };

    case "SECONDAIRE":
    default:
      return {
        typeLabel: caps.label,
        summary: getBranchTypeDescription(typebranch),
        sections: [
          {
            title: "Fonctionnalites principales",
            items: [
              "Sections, options et classes secondaires.",
              "Bulletins semestriels et ponderations par option.",
              "Inscription, finance et resultats disponibles.",
            ],
          },
        ],
        quickLinks: [
          { label: "Sections", href: "/admin/section" },
          { label: "Options", href: "/admin/option" },
          { label: "Classes", href: "/admin/classe" },
          { label: "Fiches", href: "/admin/fiches" },
          { label: "Inscription", href: "/admin/registration" },
        ],
        registrationManual: SCHOOL_REGISTRATION_MANUAL,
      };
  }
}
