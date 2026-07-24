import type { AttendanceReport } from "./attendance";
import type { EffectifsReport } from "./effectifs";
import type { FinanceReport } from "./finance";
import type { HiringReport } from "./hiring";
import type { RegistrationReport } from "./registrations";
import type { ResultsReport } from "./results";
import type { SatisfactionReport } from "./satisfaction";

export type OverviewReport = {
  students: number;
  teachers: number;
  parents: number;
  personnel: number;
  attendanceRate: number;
  budget: number;
  recoltes: number;
  reste: number;
  satisfaction: number;
  successRate: number;
  hired: number;
  registrations: number;
  comparison: Array<{
    branchName: string;
    students: number;
    attendanceRate?: number;
    recoltes: number;
    satisfaction: number;
    successRate: number;
  }>;
};

export function buildOverviewReport(input: {
  effectifs: EffectifsReport;
  attendance: AttendanceReport;
  finance: FinanceReport;
  satisfaction: SatisfactionReport;
  results: ResultsReport;
  hiring: HiringReport;
  registrations: RegistrationReport;
}): OverviewReport {
  const branchNames = new Set<string>();
  for (const b of input.effectifs.byBranch) branchNames.add(b.branchName);
  for (const b of input.finance.byBranch) branchNames.add(b.branchName);
  for (const b of input.satisfaction.byBranch) branchNames.add(b.branchName);
  for (const b of input.results.byBranch) branchNames.add(b.branchName);

  const comparison = Array.from(branchNames).map((branchName) => {
    const eff = input.effectifs.byBranch.find((b) => b.branchName === branchName);
    const fin = input.finance.byBranch.find((b) => b.branchName === branchName);
    const sat = input.satisfaction.byBranch.find(
      (b) => b.branchName === branchName,
    );
    const res = input.results.byBranch.find((b) => b.branchName === branchName);
    return {
      branchName,
      students: eff?.students ?? 0,
      recoltes: fin?.recoltes ?? 0,
      satisfaction: sat?.average ?? 0,
      successRate: res?.successRate ?? 0,
    };
  });

  return {
    students: input.effectifs.students.total,
    teachers: input.effectifs.teachers.total,
    parents: input.effectifs.parents.total,
    personnel: input.effectifs.personnel.total,
    attendanceRate: input.attendance.students.presentRate,
    budget: input.finance.budgetAnnuel,
    recoltes: input.finance.recoltes,
    reste: input.finance.reste,
    satisfaction: input.satisfaction.averageRating,
    successRate: input.results.successRate,
    hired: input.hiring.hired,
    registrations: input.registrations.registered,
    comparison,
  };
}
