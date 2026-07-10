import {
  Prisma,
  Classe,
  Teaching,
  fiche,
  Option,
  semester,
  Student,
  ClassEnrollment,
} from "@/prisma/generated/prisma/client";
import jsPDF from "jspdf";
export type Privilege = "view" | "add" | "update" | "delete";

export type RoutePrivilegeMap = {
  [routePattern: string]: {
    [role: string]: Privilege[];
  };
};
/* ===== TYPES ===== */
export type TeacherLesson = {
  id: string;
  classId: string;
  className: string;
  codeclasse: string;
  subjectName: string;
  maxScore: number;
};
export type Teacher = {
  id: string;
  name: string;
  lessons: TeacherLesson[];
};
export type Period = { id: number; label: string };

export type FicheTypes = "ficheCote" | "evaluations";
export function formatOrdinalFR(rank: number, total: number): string {
  let suffix: string;

  if (rank === 1) {
    suffix = "e"; // "1e"
  } else {
    suffix = "è"; // 2è, 3è, etc.
  }

  return `${rank}${suffix}/${total}`;
}
export interface MenuItem {
  id: number;
  href: string;
  icon?: string | null;
  name: string;
  parentId: number | null;
  section?: string | null;
  ord?: number | null;
}

export interface MenuItemClient {
  label: string;
  href: string;
  icon: string | null; // <- autorise null
  children?: MenuItemClient[];
}

export type MenuSection = {
  title: string;
  items: MenuItemClient[];
};
export type ResultType = {
  mark: number;
  period: string;
  semester: string;
};
export type StudentList = Student & {
  user?: {
    id: string;
    name?: string;
    firstname?: string;
    lastname?: string;
    surname?: string | null;
    username?: string;
    phone?: string;
    img?: string;
    address?: string;
  };

  studentAffectation: Array<{
    ClassSection: ClassEnrollment & {
      _count?: {
        lessons?: number;
      };
      Renamedclass?: Classe & {
        teaching?: Teaching & {};
      };
    };

    payment?: Array<{
      amount_us: number;
      amount_local: number;
      fee?: {
        label: string;
        amount: number;
        periodId?: number;
      };
    }>;

    teacher?: {
      name?: string;
      firstname?: string;
      lastname?: string;
      surname?: string | null;
      img?: string;
      phone?: string;
    };
  }>;

  teacherImg?: string;
  primaryClassName?: string;
};

export interface jsPDFWithPlugin extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}
export interface Semestre1 {
  p1: any;
  p2: any;
  exam1: any;
  tot1: any;
}

export interface Semestre2 {
  p3: any;
  p4: any;
  exam2: any;
  tot2: any;
}

export type MaxScore = 0 | 10 | 20 | 40 | 50;
export type MaximaType = "typeA" | "typeB" | "typeC" | "typeD" | "typeE";

export interface NoteData {
  score: number;
  maxScore: MaxScore;
}

export interface StudentPeriod {
  periodName: string;
  notes: Record<string, NoteData>;
  autres?: Record<string, any>; // ✅ AJOUT ICI
}
export type StudentPeriodUI = StudentPeriod & {
  active?: boolean;
};
export type PeriodKey =
  | "p1"
  | "p2"
  | "p3"
  | "p4"
  | "p5"
  | "p6"
  | "exam1"
  | "exam2"
  | "exam3";

export type Subject = {
  name: string;
  sem1: Record<string, number>;
  sem2: Record<string, number>;
  sem3?: Record<string, number>;
  baseMaxScore: MaxScore; // ✅ BARÈME MATIÈRE (FIXE)
};

export interface Bloc {
  blocName: string;
  maximaType: MaximaType;
  subjects: Subject[];
}
export type TotalKey = "tt1" | "tt2" | "tg";
export type SemKey = PeriodKey | TotalKey;

export type PeriodLabel =
  | "1ere Periode"
  | "2e Periode"
  | "3e Periode"
  | "4e Periode"
  | "5e Periode"
  | "6e Periode"
  | "Examen 1er semestre"
  | "Examen 2e semestre"
  | "Examen 1er trimestre"
  | "Examen 2e trimestre"
  | "Examen 3e trimestre"
  | "1st Period"
  | "2nd Period"
  | "3tr Period"
  | "4th Period"
  | "Exam 1st semester"
  | "Exam 2nd semester"
  | "1er Periode"
  | "Exam 1er trimestre"
  | "Exam 2e trimestre"
  | "Exam 3e trimestre";

export type ApplicationType = {
  sem1: Record<SemKey, string>;
  sem2: Record<SemKey, string>;
};

export type TypeFiche = {
  TOTAUX: ApplicationType;
  POURCENTAGES: ApplicationType;
  "PLACE/NOMBRE D'ELEVES": ApplicationType;
  APPLICATIONS: ApplicationType;
  CONDUITE: ApplicationType;
  "SIGNATURE PARENTS": ApplicationType;
};

export const periodKeyMap: Record<PeriodLabel, PeriodKey> = {
  "1ere Periode": "p1",
  "2e Periode": "p2",
  "3e Periode": "p3",
  "4e Periode": "p4",
  "5e Periode": "p5",
  "6e Periode": "p6",
  "Examen 1er semestre": "exam1",
  "Examen 2e semestre": "exam2",
  "Examen 1er trimestre": "exam1",
  "Examen 2e trimestre": "exam2",
  "Examen 3e trimestre": "exam3",
  "1st Period": "p1",
  "2nd Period": "p2",
  "Exam 1st semester": "exam1",
  "3tr Period": "p3",
  "4th Period": "p4",
  "Exam 2nd semester": "exam2",
  "1er Periode": "p1",
  "Exam 1er trimestre": "exam1",
  "Exam 2e trimestre": "exam2",
  "Exam 3e trimestre": "exam3",
};

export const SEM_ORDER: Record<
  "sem1" | "sem2",
  readonly (PeriodKey | TotalKey)[]
> = {
  sem1: ["p1", "p2", "exam1", "tt1"],
  sem2: ["p3", "p4", "exam2", "tt2"],
};

export function getLastValue(
  semObj: Partial<Record<PeriodKey, string>>,
  order: readonly PeriodKey[],
  currentKey: PeriodKey,
): string {
  const index = order.indexOf(currentKey);
  if (index === -1) return "-";

  for (let i = index; i >= 0; i--) {
    const key = order[i];
    const value = semObj[key];
    if (value && value !== "") return value;
  }
  return "-";
}
// --- Exemple pour un étudiant ---
export function getPlaceValue(
  student: RecapRow,
  selectedPeriod: PeriodLabel,
): string {
  // 1️⃣ Déterminer la clé de la période sélectionnée
  const selectedKey = periodKeyMap[selectedPeriod as PeriodLabel];
  if (!selectedKey) return "-";

  // 2️⃣ Déterminer le semestre
  const semester: "sem1" | "sem2" =
    selectedKey === "p1" || selectedKey === "p2" ? "sem1" : "sem2";

  // 3️⃣ Filtrer toutes les périodes jusqu'à la sélection
  const activePeriods = student.periods.filter((p) => {
    const pKey = periodKeyMap[p.periodName as PeriodLabel];
    if (!pKey) return false;

    // ne garder que les périodes dans le même semestre et avant ou égales à la sélection
    const order = SEM_ORDER[semester].filter(
      (k): k is PeriodKey => k !== "tt1" && k !== "tt2",
    );
    return order.indexOf(pKey) <= order.indexOf(selectedKey);
  });

  // 4️⃣ Parcourir toutes ces périodes pour récupérer la dernière valeur non vide
  let placeValue = "-";

  for (const p of activePeriods) {
    const autresData = p.autres as TypeFiche;
    const pKey = periodKeyMap[p.periodName as PeriodLabel];
    if (!pKey) continue;

    const semObj = autresData["POURCENTAGES"][semester] as Record<
      PeriodKey,
      string
    >;

    // getLastValue parcourt l'ordre sem1 ou sem2 pour trouver la dernière valeur non vide jusqu'à pKey
    const order = SEM_ORDER[semester].filter(
      (k): k is PeriodKey => k !== "tt1" && k !== "tt2",
    );
    const last = getLastValue(semObj, order, pKey);

    if (last && last !== "-") placeValue = last; // garder la dernière valeur non vide
  }

  return placeValue;
}

export type RecapPeriod = {
  classId?: string;
  periodName: string;
  anneeName: string;
  datecreate?: string;
  notes: Record<
    string, // subjectName
    {
      score: number;
      maxScore: number;
      periodName: string;
      anneeName: string;
      application?: string;
      connduite?: string;
      comment?: string;
    }
  >;
  autres: TypeFiche;
};
export type StudentType = {
  id: string;
  studentid: string;
  nom: string;
  surname: string;
  username: string;
  naissance: string; // ISO date string
  classe: string;
  sexe: string;
  classid: string;
};

export type Result = {
  id: string;
  studentId?: string;
  name: string;
  date: string;
  status?: string;
  note: number;
  total: number;
  periodName: string;
  yearName: string;
  classId: number;
  Maxscore?: number;
  TypeFiche?: string;
  Percentage?: string;
  Comment?: string;
  sexe?: "M" | "F"; // ✅ AJOUT
};
export type RecapRow = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentnaissance: string;
  studentclasse: string;
  studentSexe: string;
  periods: RecapPeriod[];
  classId?: string;
};
export const maximaProfiles: Record<string, [Semestre1, Semestre2]> = {
  typeA: [
    { p1: 10, p2: 10, exam1: 20, tot1: 40 },
    { p3: 10, p4: 10, exam2: 20, tot2: 40 },
  ],
  typeB: [
    { p1: 20, p2: 20, exam1: 40, tot1: 80 },
    { p3: 20, p4: 20, exam2: 40, tot2: 80 },
  ],
  typeC: [
    { p1: 40, p2: 40, exam1: 80, tot1: 160 },
    { p3: 40, p4: 40, exam2: 80, tot2: 160 },
  ],
  typeD: [
    { p1: 0, p2: 0, exam1: 0, tot1: 0 },
    { p3: 0, p4: 0, exam2: 0, tot2: 0 },
  ],
  typeE: [
    { p1: 50, p2: 50, exam1: 100, tot1: 200 },
    { p3: 50, p4: 50, exam2: 100, tot2: 200 },
  ],
};
export function getMaximaType(maxScore: MaxScore): MaximaType {
  const map: Record<MaxScore, MaximaType> = {
    50: "typeE",
    40: "typeC",
    20: "typeB",
    10: "typeA",
    0: "typeD",
  };
  return map[maxScore];
}

// Map period indices to semester and periodKey
export type SemesterKey = "sem1" | "sem2" | "sem3";

// Define period keys and semester mapping
export const periodKeyDefinitions: Record<PeriodKey, SemesterKey> = {
  p1: "sem1",
  p2: "sem1",
  exam1: "sem1", // exam 1er semestre
  p3: "sem2",
  p4: "sem2",
  exam2: "sem2", // exam 1er semestre
  p5: "sem3",
  p6: "sem3",
  exam3: "sem3",
};
export type Lesson = { id: string; subjectName: string };
export type ClassType = {
  id: string;
  name: string;
  codename: string;
  capacity: number;
  supervisor: string;
  lessons: Lesson[] | undefined;
};
export type periodsType = {
  id: number;
  value: string;
  label: string;
}[];
export type FicheNote = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentnaissance: string;
  studentclasse: string;
  studentSexe: "M" | "F";
  score: number;
  maxScore: number;
};

export type Fiche = {
  id: string; // ✅
  studentId?: string;
  teacherName: string;
  subjectName: string;
  periodName: string;
  className: string;
  dateCreated: string;
  anneeName: string;
  typeFiche: string | null;
  notes: any[];
  autres: any;
  application?: string;
  conduite?: string;
  comment?: string;
};

export type ApplicationTypes = {
  sem1: { p1: string; p2: string; exam1: string; tt1: string };
  sem2: { p3: string; p4: string; exam2: string; tt2: string };
};

export type ClassStats = { studentsCount: number; fichesCount: number };

export function canShowPeriod(
  sem: "sem1" | "sem2",
  key: "p1" | "p2" | "p3" | "p4" | "exam1" | "exam2",
  active: string[],
): boolean {
  // --- SEMESTRE 1 ---
  if (sem === "sem1") {
    // Dès qu'on est en semestre 2 → tout sem1 visible
    if (active.some((k) => ["p3", "p4"].includes(k))) return true;

    // Exam 1er semestre → tout sem1 visible
    if (active.includes("exam1")) return true;

    // Sinon cumul progressif
    if (key === "p1") return active.includes("p1");
    if (key === "p2") return active.includes("p2");
    if (key === "exam1") return false;

    return false;
  }

  // --- SEMESTRE 2 ---
  if (sem === "sem2") {
    if (key === "p3") return active.includes("p3");
    if (key === "p4") return active.includes("p4");
    if (key === "exam2") return active.includes("exam2");
  }

  return false;
}

export function canShowTot1(active: string[]) {
  // tant qu'on est uniquement en p1 ou p2 → pas visible
  return active.some((k) => ["exam1", "p3", "p4"].includes(k));
}
export function canShowTot2(active: string[]) {
  return active.some((k) => ["exam2"].includes(k));
}
export function computeTotSem1(subject: Subject, active: string[]): number {
  let total = 0;

  if (canShowPeriod("sem1", "p1", active)) {
    total += subject.sem1.p1 || 0;
  }

  if (canShowPeriod("sem1", "p2", active)) {
    total += subject.sem1.p2 || 0;
  }

  if (canShowPeriod("sem1", "exam1", active)) {
    total += subject.sem1.exam1 || 0;
  }

  return total;
}
export function computeTotSem2(subject: Subject, active: string[]): number {
  let total = 0;

  if (canShowPeriod("sem2", "p3", active)) {
    total += subject.sem2.p3 || 0;
  }

  if (canShowPeriod("sem2", "p4", active)) {
    total += subject.sem2.p4 || 0;
  }

  if (canShowPeriod("sem2", "exam2", active)) {
    total += subject.sem2.exam2 || 0;
  }

  return total;
}
export type BlocValue = {
  sem1: Record<string, string>;
  sem2: Record<string, string>;
};

export type AutresFiche = {
  TOTAUX: {
    sem1: Record<string, string>;
    sem2: Record<string, string>;
  };
  POURCENTAGES: {
    sem1: Record<string, string>;
    sem2: Record<string, string>;
  };
  "PLACE/NOMBRE D'ELEVES": {
    sem1: Record<string, string>;
    sem2: Record<string, string>;
  };
  APPLICATIONS: {
    sem1: Record<string, string>;
    sem2: Record<string, string>;
  };
  CONDUITE: {
    sem1: Record<string, string>;
    sem2: Record<string, string>;
  };
  "SIGNATURE PARENTS": {
    sem1: Record<string, string>;
    sem2: Record<string, string>;
  };
};
export function drawCell1(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  options?: {
    isMaxima?: boolean;
    align?: "left" | "center" | "right";
    color?: "black" | "white" | "red" | "blue" | "green" | "yellow" | "gray";
    fill?: "black" | "white" | "red" | "blue" | "green" | "yellow" | "gray";
    borders?: {
      top?: boolean;
      bottom?: boolean;
      left?: boolean;
      right?: boolean;
    };
  },
) {
  const palette: Record<string, [number, number, number]> = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    blue: [0, 0, 255],
    green: [0, 128, 0],
    yellow: [255, 255, 0],
    gray: [128, 128, 128],
  };

  const align = options?.align ?? "center";
  const isMaxima = options?.isMaxima ?? false;

  let textColor = palette[options?.color ?? "black"];
  let fillColor = palette[options?.fill ?? "white"];

  if (isMaxima) {
    textColor = palette.white;
    fillColor = palette.black;
  }

  doc.setFillColor(...fillColor);
  doc.setTextColor(...textColor);

  // fond
  doc.rect(x, y, w, h, "F");

  const borders = options?.borders ?? {};

  if (borders.top ?? true) doc.line(x, y, x + w, y);
  if (borders.bottom ?? true) doc.line(x, y + h, x + w, y + h);
  if (borders.left ?? true) doc.line(x, y, x, y + h);
  if (borders.right ?? true) doc.line(x + w, y, x + w, y + h);

  let textX = x + w / 2;
  if (align === "left") textX = x + 2;
  if (align === "right") textX = x + w - 2;

  doc.text(text, textX, y + h / 2, {
    align,
    baseline: "middle",
  });
}
export function drawSemesterRow1(
  doc: jsPDF,
  y: number,
  sem1: any,
  sem2: any,
  config: any,
) {
  const {
    colPos,
    shiftX,
    sem1PeriodWidths,
    sem2PeriodWidths,
    sem1SubWidths,
    sem2SubWidths,
    totX1,
    totX2,
    examX1,
    examX2,
    maximaHeight,
  } = config;

  const values = [
    [colPos[1] + shiftX, sem1PeriodWidths[0], sem1?.p1],
    [colPos[1] + shiftX + sem1PeriodWidths[0], sem1PeriodWidths[1], sem1?.p2],
    [totX1, sem1SubWidths[1], sem1?.exam1],
    [examX1, sem1SubWidths[2], sem1?.tt1],

    [colPos[2] + shiftX, sem2PeriodWidths[0], sem2?.p3],
    [colPos[2] + shiftX + sem2PeriodWidths[0], sem2PeriodWidths[1], sem2?.p4],
    [totX2, sem2SubWidths[1], sem2?.exam2],
    [examX2, sem2SubWidths[2], sem2?.tt2],
  ];

  values.forEach(([x, w, value]: any) => {
    drawCell1(doc, x, y, w, maximaHeight, String(value ?? ""), {
      isMaxima: true,
    });
  });
}
type DrawCellFn = (
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  isMaxima?: boolean,
  align?: "left" | "center" | "right",
  color?:
    | "black"
    | "white"
    | "red"
    | "blue"
    | "green"
    | { text?: string; fill?: string },
  borders?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  },
) => void;

export function drawSubjectRow(
  drawCell: DrawCellFn,
  yPosBlocs: number,
  shiftX: number,
  colPos: number[],
  colWidths: number[],
  sem1PeriodWidths: number[],
  sem2PeriodWidths: number[],
  sem1SubWidths: number[],
  sem2SubWidths: number[],
  totX1: number,
  examX1: number,
  totX2: number,
  examX2: number,
  maximaHeight: number,
  subject: { name: string },
  autresByPeriod: Record<string, any>,
  generalesMaximaSem1P1: number,
  generalesMaximaSem1P2: number,
  generalesMaximaTot1: number,
  generalesMaximaSem2P3: number,
  generalesMaximaSem2P4: number,
  generalesMaximaTot2: number,
  getColorPourcentage: (value: number, type: string, max: number) => string,
  safeStr: (val: any) => string,
  isGeneraux?: boolean,
) {
  /* --------------------------------------------------------- */
  /* LIGNES SPECIALES (PLACE / APPLICATIONS / CONDUITE) */
  /* --------------------------------------------------------- */

  const specialRows = ["APPLICATIONS", "CONDUITE"];

  if (isGeneraux && specialRows.includes(subject.name)) {
    const key = subject.name;

    drawCell(
      colPos[0] + shiftX,
      yPosBlocs,
      colWidths[0],
      maximaHeight,
      key,
      false,
      "left",
    );

    /* Semestre 1 périodes */

    [0, 1].forEach((i) => {
      drawCell(
        colPos[1] +
          shiftX +
          sem1PeriodWidths.slice(0, i).reduce((a, b) => a + b, 0),
        yPosBlocs,
        sem1PeriodWidths[i],
        maximaHeight,
        autresByPeriod[`p${i + 1}`]?.[key]?.sem1?.[`p${i + 1}`],
        false,
        "center",
      );
    });

    /* Semestre 1 exam */

    drawCell(
      totX1,
      yPosBlocs,
      sem1SubWidths[1],
      maximaHeight,
      "",
      false,
      "center",
      { text: "black", fill: "black" },
    );

    /* Semestre 1 total */

    drawCell(
      examX1,
      yPosBlocs,
      sem1SubWidths[2],
      maximaHeight,
      autresByPeriod["exam1"]?.[key]?.sem1?.tt1 ?? "",
      false,
      "center",
      { text: "black", fill: "black" },
    );

    /* Semestre 2 périodes */

    [2, 3].forEach((i, idx) => {
      drawCell(
        colPos[2] +
          shiftX +
          sem2PeriodWidths.slice(0, idx).reduce((a, b) => a + b, 0),
        yPosBlocs,
        sem2PeriodWidths[idx],
        maximaHeight,
        autresByPeriod[`p${i + 1}`]?.[key]?.sem2?.[`p${i + 1}`],
        false,
        "center",
      );
    });

    /* Semestre 2 exam */

    drawCell(
      totX2,
      yPosBlocs,
      sem2SubWidths[1],
      maximaHeight,
      "",
      false,
      "center",
      { text: "black", fill: "black" },
    );

    /* Semestre 2 total */

    drawCell(
      examX2,
      yPosBlocs,
      sem2SubWidths[2],
      maximaHeight,
      autresByPeriod["exam2"]?.[key]?.sem2?.tt2 ?? "",
      false,
      "center",
      { text: "black", fill: "black" },
    );

    /* Total général */

    drawCell(
      colPos[3] + shiftX,
      yPosBlocs,
      colWidths[3],
      maximaHeight,
      autresByPeriod["exam2"]?.[key]?.sem2?.tg ?? "",
      false,
      "center",
      { text: "black", fill: "black" },
    );

    drawCell(
      colPos[4] + shiftX,
      yPosBlocs,
      colWidths[4],
      maximaHeight,
      "",
      false,
      "center",
      { text: "black", fill: "black" },
    );

    drawCell(
      colPos[5] + shiftX,
      yPosBlocs,
      4,
      maximaHeight,
      "",
      true,
      "center",
      { text: "white", fill: "white" },
      { top: false, bottom: true, left: true, right: false },
    );

    return yPosBlocs + maximaHeight;
  }
  /* --------------------------------------------------------- */
  /* SIGNATURE PARENTS */
  /* --------------------------------------------------------- */

  if (isGeneraux && subject.name === "PLACE/NOMBRE D'ELEVES") {
    const key = subject.name;
    drawCell(
      colPos[0] + shiftX,
      yPosBlocs,
      colWidths[0],
      maximaHeight,
      subject.name,
      false,
      "left",
    );

    /* Semestre 1 périodes */

    [0, 1].forEach((i) => {
      drawCell(
        colPos[1] +
          shiftX +
          sem1PeriodWidths.slice(0, i).reduce((a, b) => a + b, 0),
        yPosBlocs,
        sem1PeriodWidths[i],
        maximaHeight,
        autresByPeriod[`p${i + 1}`]?.[key]?.sem1?.[`p${i + 1}`],
        false,
        "center",
      );
    });

    const sem1ExamStr = safeStr(autresByPeriod["exam1"]?.[key]?.sem1?.exam1);

    drawCell(
      totX1,
      yPosBlocs,
      sem1SubWidths[1],
      maximaHeight,
      sem1ExamStr,
      false,
      "center",
      {
        text: "black",
        fill: "black",
      },
    );

    const sem1TotStr = safeStr(autresByPeriod["exam1"]?.[key]?.sem1?.tt1);

    drawCell(
      examX1,
      yPosBlocs,
      sem1SubWidths[2],
      maximaHeight,
      sem1TotStr,
      false,
      "center",
      {
        text: "black",
        fill: "white",
      },
    );

    for (let i = 0; i < 2; i++) {
      const periodKey = `p${i + 3}`; // p3, p4
      const valStr = safeStr(
        autresByPeriod[periodKey]?.[key]?.sem2?.[periodKey],
      );
      const valNum = parseInt(valStr) || 0;
      const max = i === 0 ? generalesMaximaSem2P3 : generalesMaximaSem2P4;

      drawCell(
        colPos[2] +
          shiftX +
          sem2PeriodWidths.slice(0, i).reduce((a, b) => a + b, 0),
        yPosBlocs,
        sem2PeriodWidths[i],
        maximaHeight,
        valStr,
        false,
        "center",
        {
          text: "Black",
          fill: "white",
        },
      );
    }

    const sem2ExamStr = safeStr(autresByPeriod["exam2"]?.[key]?.sem2?.exam2);

    drawCell(
      totX2,
      yPosBlocs,
      sem2SubWidths[1],
      maximaHeight,
      sem2ExamStr,
      false,
      "center",
      {
        text: "black",
        fill: "black",
      },
    );

    const sem2TotStr = safeStr(autresByPeriod["exam2"]?.[key]?.sem2?.tt2);

    drawCell(
      examX2,
      yPosBlocs,
      sem2SubWidths[2],
      maximaHeight,
      sem2TotStr,
      false,
      "center",
      {
        text: "black",
        fill: "white",
      },
    );

    const sem2GenStr = safeStr(autresByPeriod["exam2"]?.[key]?.sem2?.tg);
    const sem2GenNum = parseInt(sem2GenStr) || 0;

    drawCell(
      colPos[3] + shiftX,
      yPosBlocs,
      colWidths[3],
      maximaHeight,
      sem2GenStr,
      false,
      "center",
      {
        text: "black",
        fill: "white",
      },
    );

    drawCell(
      colPos[4] + shiftX,
      yPosBlocs,
      colWidths[4],
      maximaHeight,
      "",
      false,
      "center",
    );

    drawCell(
      colPos[5] + shiftX,
      yPosBlocs,
      4,
      maximaHeight,
      "",
      true,
      "center",
      { text: "white", fill: "white" },
      { top: false, bottom: true, left: true, right: false },
    );

    return yPosBlocs + maximaHeight;
  }
  /* --------------------------------------------------------- */
  /* SIGNATURE PARENTS */
  /* --------------------------------------------------------- */

  if (isGeneraux && subject.name === "SIGNATURE PARENTS") {
    drawCell(
      colPos[0] + shiftX,
      yPosBlocs,
      colWidths[0],
      maximaHeight,
      subject.name,
      false,
      "left",
    );

    const blank = { text: "white", fill: "white" };

    const borders = {
      top: true,
      bottom: true,
      left: false,
      right: false,
    };

    drawCell(
      colPos[1] + shiftX,
      yPosBlocs,
      sem1PeriodWidths[0],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      { ...borders, left: true },
    );

    drawCell(
      colPos[1] + shiftX + sem1PeriodWidths[0],
      yPosBlocs,
      sem1PeriodWidths[1],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      totX1,
      yPosBlocs,
      sem1SubWidths[1],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      examX1,
      yPosBlocs,
      sem1SubWidths[2],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      colPos[2] + shiftX,
      yPosBlocs,
      sem2PeriodWidths[0],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      { ...borders, left: true },
    );

    drawCell(
      colPos[2] + shiftX + sem2PeriodWidths[0],
      yPosBlocs,
      sem2PeriodWidths[1],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      totX2,
      yPosBlocs,
      sem2SubWidths[1],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      examX2,
      yPosBlocs,
      sem2SubWidths[2],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      colPos[3] + shiftX,
      yPosBlocs,
      colWidths[3],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      colPos[4] + shiftX,
      yPosBlocs,
      colWidths[4],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      borders,
    );

    drawCell(
      colPos[5] + shiftX,
      yPosBlocs,
      4,
      maximaHeight,
      "",
      true,
      "center",
      blank,
      { top: false, bottom: true, left: true, right: false },
    );

    drawCell(
      colPos[6] + shiftX,
      yPosBlocs,
      34.1,
      maximaHeight,
      "",
      false,
      "center",
      blank,
      { top: false, bottom: true, left: true, right: true },
    );

    return yPosBlocs + maximaHeight;
  }

  /* --------------------------------------------------------- */
  /* CAS NORMAL (TOTAUX / POURCENTAGES) */
  /* --------------------------------------------------------- */

  const isPercentage = isGeneraux && subject.name === "POURCENTAGES";
  const dataKey = isPercentage ? "POURCENTAGES" : "TOTAUX";

  drawCell(
    colPos[0] + shiftX,
    yPosBlocs,
    colWidths[0],
    maximaHeight,
    subject.name,
    false,
    "left",
  );

  for (let i = 0; i < 2; i++) {
    const valStr = safeStr(
      autresByPeriod[`p${i + 1}`]?.[dataKey]?.sem1?.[`p${i + 1}`],
    );
    const valNum = parseInt(valStr) || 0;

    const max = i === 0 ? generalesMaximaSem1P1 : generalesMaximaSem1P2;

    drawCell(
      colPos[1] +
        shiftX +
        sem1PeriodWidths.slice(0, i).reduce((a, b) => a + b, 0),
      yPosBlocs,
      sem1PeriodWidths[i],
      maximaHeight,
      valStr,
      false,
      "center",
      {
        text: getColorPourcentage(
          valNum,
          isPercentage ? "percentage" : "score",
          max,
        ),
        fill: "white",
      },
    );
  }

  const sem1ExamStr = safeStr(autresByPeriod["exam1"]?.[dataKey]?.sem1?.exam1);

  drawCell(
    totX1,
    yPosBlocs,
    sem1SubWidths[1],
    maximaHeight,
    sem1ExamStr,
    false,
    "center",
    {
      text: "black",
      fill: "black",
    },
  );

  const sem1TotStr = safeStr(autresByPeriod["exam1"]?.[dataKey]?.sem1?.tt1);

  drawCell(
    examX1,
    yPosBlocs,
    sem1SubWidths[2],
    maximaHeight,
    sem1TotStr,
    false,
    "center",
    {
      text: "black",
      fill: "white",
    },
  );

  for (let i = 0; i < 2; i++) {
    const periodKey = `p${i + 3}`; // p3, p4
    const valStr = safeStr(
      autresByPeriod[periodKey]?.[dataKey]?.sem2?.[periodKey],
    );
    const valNum = parseInt(valStr) || 0;
    const max = i === 0 ? generalesMaximaSem2P3 : generalesMaximaSem2P4;

    drawCell(
      colPos[2] +
        shiftX +
        sem2PeriodWidths.slice(0, i).reduce((a, b) => a + b, 0),
      yPosBlocs,
      sem2PeriodWidths[i],
      maximaHeight,
      valStr,
      false,
      "center",
      {
        text: getColorPourcentage(
          valNum,
          isPercentage ? "percentage" : "score",
          max,
        ),
        fill: "white",
      },
    );
  }

  const sem2ExamStr = safeStr(autresByPeriod["exam2"]?.[dataKey]?.sem2?.exam2);

  drawCell(
    totX2,
    yPosBlocs,
    sem2SubWidths[1],
    maximaHeight,
    sem2ExamStr,
    false,
    "center",
    {
      text: "black",
      fill: "black",
    },
  );

  const sem2TotStr = safeStr(autresByPeriod["exam2"]?.[dataKey]?.sem2?.tt2);

  drawCell(
    examX2,
    yPosBlocs,
    sem2SubWidths[2],
    maximaHeight,
    sem2TotStr,
    false,
    "center",
    {
      text: "black",
      fill: "white",
    },
  );

  const sem2GenStr = safeStr(autresByPeriod["exam2"]?.[dataKey]?.sem2?.tg);
  const sem2GenNum = parseInt(sem2GenStr) || 0;

  drawCell(
    colPos[3] + shiftX,
    yPosBlocs,
    colWidths[3],
    maximaHeight,
    sem2GenStr,
    false,
    "center",
    {
      text: getColorPourcentage(
        sem2GenNum,
        isPercentage ? "percentage" : "score",
        generalesMaximaTot1 + generalesMaximaTot2,
      ),
      fill: "white",
    },
  );

  drawCell(
    colPos[4] + shiftX,
    yPosBlocs,
    colWidths[4],
    maximaHeight,
    "",
    false,
    "center",
  );

  drawCell(
    colPos[5] + shiftX,
    yPosBlocs,
    4,
    maximaHeight,
    "",
    true,
    "center",
    { text: "white", fill: "white" },
    { top: false, bottom: true, left: true, right: false },
  );

  return yPosBlocs + maximaHeight;
}
const getColorPourcentage = (
  value: number,
  type: string,
  maxValue: number,
): string => {
  if (type === "percentage") {
    return value < 50 ? "red" : "black";
  }

  if (!maxValue) return "black";

  return value < maxValue / 2 ? "red" : "black";
};
type GetColorFn = (value: number, type: string, max: number) => string;

export function drawMatiere(
  drawCell: DrawCellFn,
  yPosBlocs: number,
  shiftX: number,
  colPos: number[],
  colWidths: number[],
  sem1PeriodWidths: number[],
  sem2PeriodWidths: number[],
  sem1SubWidths: number[],
  sem2SubWidths: number[],
  totX1: number,
  examX1: number,
  totX2: number,
  examX2: number,
  maximaHeight: number,
  subject: any,
  activePeriodKeys: string[],
  getColor: GetColorFn,
  computeTotSem1: (subject: any, keys: string[]) => number,
  computeTotSem2: (subject: any, keys: string[]) => number,
  canShowTot1: (keys: string[]) => boolean,
  canShowTot2: (keys: string[]) => boolean,
  maximaTot1: number,
  maximaTot2: number,
  maximaTG: number,
) {
  /* ------------------ NOM MATIERE ------------------ */
  drawCell(
    colPos[0] + shiftX,
    yPosBlocs,
    colWidths[0],
    maximaHeight,
    subject.name.toUpperCase(),
    false,
    "left",
  );

  /* ------------------ SEMESTRE 1 ------------------ */

  const getVal = (key: string, val: number) =>
    activePeriodKeys.includes(key) && val !== 0 ? String(val) : "";

  drawCell(
    colPos[1] + shiftX,
    yPosBlocs,
    sem1PeriodWidths[0],
    maximaHeight,
    getVal("p1", subject.sem1.p1),
    false,
    "center",
    {
      text: getColor(subject.sem1.p1, "score", subject.baseMaxScore),
      fill: "white",
    },
  );

  drawCell(
    colPos[1] + shiftX + sem1PeriodWidths[0],
    yPosBlocs,
    sem1PeriodWidths[1],
    maximaHeight,
    getVal("p2", subject.sem1.p2),
    false,
    "center",
    {
      text: getColor(subject.sem1.p2, "score", subject.baseMaxScore),
      fill: "white",
    },
  );

  drawCell(
    totX1,
    yPosBlocs,
    sem1SubWidths[1],
    maximaHeight,
    getVal("exam1", subject.sem1.exam1),
    false,
    "center",
    {
      text: getColor(subject.sem1.exam1, "score", subject.baseMaxScore * 2),
      fill: "white",
    },
  );

  const tt1TotalScore = computeTotSem1(subject, activePeriodKeys);

  drawCell(
    examX1,
    yPosBlocs,
    sem1SubWidths[2],
    maximaHeight,
    canShowTot1(activePeriodKeys) && tt1TotalScore !== 0
      ? String(tt1TotalScore)
      : "",
    false,
    "center",
    {
      text: getColor(tt1TotalScore, "score", maximaTot1),
      fill: "white",
    },
  );

  /* ------------------ SEMESTRE 2 ------------------ */

  drawCell(
    colPos[2] + shiftX,
    yPosBlocs,
    sem2PeriodWidths[0],
    maximaHeight,
    getVal("p3", subject.sem2.p3),
    false,
    "center",
    {
      text: getColor(subject.sem2.p3, "score", subject.baseMaxScore),
      fill: "white",
    },
  );

  drawCell(
    colPos[2] + shiftX + sem2PeriodWidths[0],
    yPosBlocs,
    sem2PeriodWidths[1],
    maximaHeight,
    getVal("p4", subject.sem2.p4),
    false,
    "center",
    {
      text: getColor(subject.sem2.p4, "score", subject.baseMaxScore),
      fill: "white",
    },
  );

  drawCell(
    totX2,
    yPosBlocs,
    sem2SubWidths[1],
    maximaHeight,
    getVal("exam2", subject.sem2.exam2),
    false,
    "center",
    {
      text: getColor(subject.sem2.exam2, "score", subject.baseMaxScore * 2),
      fill: "white",
    },
  );

  const tt2TotalScore = computeTotSem2(subject, activePeriodKeys);

  drawCell(
    examX2,
    yPosBlocs,
    sem2SubWidths[2],
    maximaHeight,
    canShowTot2(activePeriodKeys) && tt2TotalScore !== 0
      ? String(tt2TotalScore)
      : "",
    false,
    "center",
    {
      text: getColor(tt2TotalScore, "score", maximaTot2),
      fill: "white",
    },
  );

  /* ------------------ TOTAL GENERAL ------------------ */

  const tgTotalScore =
    tt1TotalScore > 0 &&
    tt2TotalScore > 0 &&
    canShowTot1(activePeriodKeys) &&
    canShowTot2(activePeriodKeys)
      ? tt1TotalScore + tt2TotalScore
      : 0;

  drawCell(
    colPos[3] + shiftX,
    yPosBlocs,
    colWidths[3],
    maximaHeight,
    tgTotalScore !== 0 ? String(tgTotalScore) : "",
    false,
    "center",
    {
      text: getColor(tgTotalScore, "score", maximaTG),
      fill: "white",
    },
  );

  /* ------------------ COLONNES VIDES ------------------ */

  drawCell(
    colPos[4] + shiftX,
    yPosBlocs,
    colWidths[4],
    maximaHeight,
    "",
    false,
  );

  drawCell(colPos[5] + shiftX, yPosBlocs, 16, maximaHeight, "", true, "left");

  drawCell(colPos[6] + shiftX, yPosBlocs, 13, maximaHeight, "", false, "left");

  drawCell(
    colPos[7] - 2,
    yPosBlocs,
    21,
    maximaHeight,
    "",
    false,
    "center",
    { text: "white", fill: "white" },
    { top: true, bottom: true, left: true, right: true },
  );

  return yPosBlocs + maximaHeight;
}

export const generauxConfig: Record<
  string,
  {
    getColor: GetColorFn;
    isGeneraux: boolean;
  }
> = {
  TOTAUX: {
    getColor: getColorPourcentage,
    isGeneraux: false,
  },
  POURCENTAGES: {
    getColor: getColorPourcentage,
    isGeneraux: true,
  },
  "PLACE/NOMBRE D'ELEVES": {
    getColor: getColorPourcentage,
    isGeneraux: true,
  },
  APPLICATIONS: {
    getColor: getColorPourcentage,
    isGeneraux: true,
  },
  CONDUITE: {
    getColor: getColorPourcentage,
    isGeneraux: true,
  },
  "SIGNATURE PARENTS": {
    getColor: getColorPourcentage,
    isGeneraux: true,
  },
};
