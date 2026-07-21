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

export type BranchTypeHelpContent = {
  typeLabel: string;
  summary: string;
  sections: BranchHelpSection[];
  quickLinks: Array<{ label: string; href: string }>;
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
              "Domaines RDC et fiches centrales.",
              "Inscription, finance et paiements disponibles.",
            ],
          },
        ],
        quickLinks: [
          { label: "Classes", href: "/admin/classe" },
          { label: "Fiches", href: "/admin/fiches" },
          { label: "Inscription", href: "/admin/registration" },
        ],
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
        ],
      };
  }
}
