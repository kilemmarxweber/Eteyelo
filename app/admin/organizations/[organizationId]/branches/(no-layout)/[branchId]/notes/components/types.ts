export type StudentTableColumn = {
  key: string;
  header: string;
  cell: (s: StudentRow) => React.ReactNode;
};

export type ApplicationValue = "TB" | "B" | "AB" | "A" | "AA";

export type StudentRow = {
  studentId: string;
  name: string;
  surname: string;
  firstname: string;
  lastname: string;
  daten: Date;
  classname: string;
  codestudent: string;
  sex: string;
  score: number | null;
  maxScore: number;
  application?: ApplicationValue; // 👈
  comment?: string;
  // 👇 AJOUT
  _scoreInput?: string;
};
export type DisabledSubject = {
  lessonId: string;
  periodId: number;
  typeFiche: string;
  anneeId: string;
};
export type Fiche = {
  id: string;
  status: boolean;
  periodId: number;
  typeFiche: string;
  anneeId: string;
};

export type TeacherLesson = {
  id: string;
  classId: string;
  className: string;
  codeclasse: string;
  subjectId: string;
  subjectName: string;
  maxScore: number;

  fiches?: Fiche[];
};
export type Teacher = {
  id: string;
  name: string;
  lessons: TeacherLesson[];
};
export type Period = { id: number; label: string };
export type FicheTypes = "ficheCote" | "evaluations";
/* ===== ÉLÈVES ===== */

export type Note = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentSexe: string;
  score: number | null;
  maxScore: number;
  appreciation?: string;
  conduite?: string;
  comment?: string;
};
export type TypeFiches = {
  TOTAUX: any[];
  POURCENTAGES: any[];
  "PLACE/NOMBRE D'ELEVES": any[];
  APPLICATIONS: any[];
  CONDUITE: any[];
  "SIGNATURE PARENTS": any[];
};
export const typeFichesDefault = {
  TOTAUX: [],
  POURCENTAGES: [],
  "PLACE/NOMBRE D'ELEVES": [],
  APPLICATIONS: [],
  CONDUITE: [],
  "SIGNATURE PARENTS": [],
};
type FicheOption = "global" | "cumule" | "individuel";
export interface CreateFicheParams {
  teacherId: string; // ✅ AJOUTÉ
  classId: string;
  periodId: number;
  schoolYearId: string;
  lessonId: string;
  subjectName: string;
  className: string;
  periodName: string;
  anneeId: string;
  anneeName: string;
  typeFiche: FicheTypes;
  ficheOption: FicheOption;
  notes: Note[];
  autres: TypeFiches[]; // ✅ AJOUT
  status?: boolean;
}

export interface CreateFicheResult {
  success: boolean;
  error?: boolean;
  message?: string; // ✅ AJOUT
}
export type ExcelRow = {
  ID?: string;
  Nom?: string;
  Prénom?: string;
  Lastname?: string;
  Sexe?: string;
  Score?: number;
  MaxScore?: number;
  Classname?: string;
  Codestudent?: string;
  Daten?: string;
};
