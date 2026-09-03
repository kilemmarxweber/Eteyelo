import type { AttendanceReport } from "./attendance";
import type { CreditsReport } from "./credits";
import type { EffectifsReport } from "./effectifs";
import type { FinanceReport } from "./finance";
import type { HiringReport } from "./hiring";
import type { PayrollReport } from "./payroll";
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
  payrollNet: number;
  payrollGross: number;
  payrollCount: number;
  creditsApproved: number;
  creditsOutstanding: number;
  creditsCount: number;
  satisfaction: number;
  successRate: number;
  hired: number;
  registrations: number;
  comparison: Array<{
    branchName: string;
    students: number;
    attendanceRate?: number;
    recoltes: number;
    payrollNet: number;
    creditsApproved: number;
    satisfaction: number;
    successRate: number;
  }>;
};

export function buildOverviewReport(input: {
  effectifs: EffectifsReport;
  attendance: AttendanceReport;
  finance: FinanceReport;
  payroll: PayrollReport;
  credits: CreditsReport;
  satisfaction: SatisfactionReport;
  results: ResultsReport;
  hiring: HiringReport;
  registrations: RegistrationReport;
}): OverviewReport {
  const branchNames = new Set<string>();
  for (const b of input.effectifs.byBranch) branchNames.add(b.branchName);
  for (const b of input.finance.byBranch) branchNames.add(b.branchName);
  for (const b of input.payroll.byBranch) branchNames.add(b.branchName);
  for (const b of input.credits.byBranch) branchNames.add(b.branchName);
  for (const b of input.satisfaction.byBranch) branchNames.add(b.branchName);
  for (const b of input.results.byBranch) branchNames.add(b.branchName);

  const comparison = Array.from(branchNames).map((branchName) => {
    const eff = input.effectifs.byBranch.find((b) => b.branchName === branchName);
    const fin = input.finance.byBranch.find((b) => b.branchName === branchName);
    const pay = input.payroll.byBranch.find((b) => b.branchName === branchName);
    const cred = input.credits.byBranch.find((b) => b.branchName === branchName);
    const sat = input.satisfaction.byBranch.find(
      (b) => b.branchName === branchName,
    );
    const res = input.results.byBranch.find((b) => b.branchName === branchName);
    return {
      branchName,
      students: eff?.students ?? 0,
      recoltes: fin?.recoltes ?? 0,
      payrollNet: pay?.net ?? 0,
      creditsApproved: cred?.approved ?? 0,
      satisfaction: sat?.average ?? 0,
      successRate: res?.successRate ?? 0,
    };
  });

  return {
    students: input.effectifs.students.active,
    teachers: input.effectifs.teachers.active,
    parents: input.effectifs.parents.active,
    personnel: input.effectifs.personnel.active,
    attendanceRate: input.attendance.students.presentRate,
    budget: input.finance.budgetAnnuel,
    recoltes: input.finance.recoltes,
    reste: input.finance.reste,
    payrollNet: input.payroll.net,
    payrollGross: input.payroll.gross,
    payrollCount: input.payroll.count,
    creditsApproved: input.credits.approvedAmount,
    creditsOutstanding: input.credits.outstandingAmount,
    creditsCount: input.credits.count,
    satisfaction: input.satisfaction.averageRating,
    successRate: input.results.successRate,
    hired: input.hiring.hired,
    registrations: input.registrations.registered,
    comparison,
  };
}
