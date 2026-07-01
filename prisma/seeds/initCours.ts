import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

/* ================= COURSES DATA ================= */

export const coursData = [
  {
    codeCours: "FRAN",
    nameCours: "Français",
    description: "Langue française et littérature",
    ponderation: 5,
    statusCours: true,
  },
  {
    codeCours: "MATH",
    nameCours: "Mathématiques",
    description: "Mathématiques générales",
    ponderation: 5,
    statusCours: true,
  },
  {
    codeCours: "ANG",
    nameCours: "Anglais",
    description: "Langue anglaise",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "HIST",
    nameCours: "Histoire",
    description: "Histoire générale et du Congo",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "GEO",
    nameCours: "Géographie",
    description: "Géographie du Congo et du monde",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "ECM",
    nameCours: "Éducation Civique et Morale",
    description: "Civisme et valeurs morales",
    ponderation: 1,
    statusCours: true,
  },
  {
    codeCours: "EPS",
    nameCours: "Éducation Physique",
    description: "Activités sportives et physiques",
    ponderation: 1,
    statusCours: true,
  },
  {
    codeCours: "REL",
    nameCours: "Religion",
    description: "Éducation religieuse",
    ponderation: 1,
    statusCours: true,
  },

  {
    codeCours: "PHYS",
    nameCours: "Physique",
    description: "Physique générale",
    ponderation: 4,
    statusCours: true,
  },
  {
    codeCours: "CHIM",
    nameCours: "Chimie",
    description: "Chimie générale et organique",
    ponderation: 4,
    statusCours: true,
  },
  {
    codeCours: "BIO",
    nameCours: "Biologie",
    description: "Sciences de la vie",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "SCI",
    nameCours: "Sciences",
    description: "Biologie et géologie",
    ponderation: 2,
    statusCours: true,
  },

  {
    codeCours: "COMPTA",
    nameCours: "Comptabilité",
    description: "Comptabilité générale et analytique",
    ponderation: 4,
    statusCours: true,
  },
  {
    codeCours: "ECO",
    nameCours: "Économie",
    description: "Économie générale et d'entreprise",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "GEST",
    nameCours: "Gestion",
    description: "Gestion d'entreprise",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "DROIT",
    nameCours: "Droit",
    description: "Droit commercial et civil",
    ponderation: 1,
    statusCours: true,
  },
  {
    codeCours: "MARK",
    nameCours: "Marketing",
    description: "Techniques de marketing",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "STAT",
    nameCours: "Statistiques",
    description: "Statistiques appliquées",
    ponderation: 2,
    statusCours: true,
  },

  {
    codeCours: "ELEC-PRAT",
    nameCours: "Électricité",
    description: "Travaux pratiques d'électricité",
    ponderation: 4,
    statusCours: true,
  },
  {
    codeCours: "MECA-PRAT",
    nameCours: "Mécanique",
    description: "Travaux pratiques de mécanique",
    ponderation: 4,
    statusCours: true,
  },
  {
    codeCours: "DESSIN-TECH",
    nameCours: "Dessin Technique",
    description: "Dessin industriel et technique",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "TECHNO",
    nameCours: "Technologie",
    description: "Technologie générale",
    ponderation: 2,
    statusCours: true,
  },

  {
    codeCours: "INFO",
    nameCours: "Informatique",
    description: "Initiation à l'informatique",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "PROG",
    nameCours: "Programmation",
    description: "Bases de la programmation",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "RESEAU",
    nameCours: "Réseaux",
    description: "Réseaux informatiques",
    ponderation: 2,
    statusCours: true,
  },

  {
    codeCours: "PHIL",
    nameCours: "Philosophie",
    description: "Philosophie générale",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "LITT",
    nameCours: "Littérature",
    description: "Littérature française et africaine",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "LAT",
    nameCours: "Latin",
    description: "Langue latine",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "LING",
    nameCours: "Lingala",
    description: "Langue nationale lingala",
    ponderation: 2,
    statusCours: true,
  },

  {
    codeCours: "PEDAG",
    nameCours: "Pédagogie",
    description: "Sciences de l'éducation",
    ponderation: 4,
    statusCours: true,
  },
  {
    codeCours: "PSYCHO",
    nameCours: "Psychologie",
    description: "Psychologie de l'enfant",
    ponderation: 2,
    statusCours: true,
  },
  {
    codeCours: "DIDACT",
    nameCours: "Didactique",
    description: "Méthodes d'enseignement",
    ponderation: 1,
    statusCours: true,
  },
];

/* ================= INIT ================= */

export async function initCours() {
  const branchId = await getSeedBranchId();
  console.log("📖 Initialisation des cours...");

  for (const cours of coursData) {
    try {
      await Prisma.cours.upsert({
        where: {
          codeCours: cours.codeCours,
        },
        update: {
          nameCours: cours.nameCours,
          description: cours.description,
          ponderation: cours.ponderation,
          statusCours: cours.statusCours,
          branchId,
        },
        create: {
          codeCours: cours.codeCours,
          nameCours: cours.nameCours,
          description: cours.description,
          ponderation: cours.ponderation,
          statusCours: cours.statusCours,
          branchId,
        },
      });
    } catch (err) {
      console.error(`❌ erreur cours ${cours.codeCours}`, err);
    }
  }

  console.log(`✅ ${coursData.length} cours traités`);
}

/* ================= CLEAR ================= */

export async function clearCours() {
  console.log("🗑️ Suppression des cours...");

  try {
    await Prisma.cours.deleteMany({});
    console.log("✅ Cours supprimés");
  } catch (err) {
    console.error("❌ erreur suppression cours", err);
  }
}
