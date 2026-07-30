import type { StudentBadgeData } from "@/lib/student-badge";
import type { StudentDocumentsData } from "@/lib/student-documents";
import type { StudentScheduleData } from "@/lib/student-schedule-types";
import type { StudentAnnouncementsData } from "@/lib/student-announcements-types";

export type StudentProfileFee = {
  id: string;
  label: string;
  typeFrais: string;
  amountDue: number;
  amountPaid: number;
  remaining: number;
  isPaid: boolean;
};

export type StudentProfileFinanceSummary = {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
};

export type StudentProfileSemester = {
  label: string;
  average: number;
  max: number;
};

export type StudentProfileData = {
  baseHref: string;
  /** Retour liste élèves (admin) ou tableau de bord (parent / élève sur sa fiche). */
  studentListHref: string;
  /** Libellé accessibilité du bouton retour. */
  backLabel: string;
  studentId: string;
  fullName: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: string;
  dateOfBirthLabel: string;
  ageLabel: string;
  placeOfBirth: string;
  nationality: string;
  bloodGroup: string;
  allergies: string;
  vulnerability: string;
  schoolName: string;
  matricule: string;
  schoolYearLabel: string;
  classLabel: string;
  sectionLabel: string;
  optionLabel: string;
  titulaireName: string;
  statusLabel: string;
  statusActive: boolean;
  enrollmentDateLabel: string;
  image: string | null;
  canManageStudents: boolean;
  /** Onglet finances : rôles finance, parent de l'élève, ou élève lui-même. */
  canViewFinance: boolean;
  parentFullName: string;
  parentPhone: string;
  parentEmail: string;
  parentProfession: string;
  parentAddress: string;
  parentEmergencyContact: string;
  displayId: string;
  badge: StudentBadgeData;
  fees: StudentProfileFee[];
  financeSummary: StudentProfileFinanceSummary;
  /** Devise de base du taux sélectionné (fromCurrency), comme au paiement. */
  baseCurrency: string;
  documents: StudentDocumentsData;
  semesters: StudentProfileSemester[];
  classeId: string | null;
  schedule: StudentScheduleData | null;
  announcements: StudentAnnouncementsData;
};
