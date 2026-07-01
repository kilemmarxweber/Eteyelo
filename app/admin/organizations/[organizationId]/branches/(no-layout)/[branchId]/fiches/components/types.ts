////SECTION BODY MATIERES
  export type Subject = {
    name: string;

    max1: string;
    gs1: string;
    bl1: string; // 👈 NEW

    max2: string;
    gs2: string;
    bl2: string; // 👈 NEW

    max3: string;
    gs3: string;
    bl3: string; // 👈 NEW
  };
  export type Section = {
    title: string;
    subjects: Subject[];
  };