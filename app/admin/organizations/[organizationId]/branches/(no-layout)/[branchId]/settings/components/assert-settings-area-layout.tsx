import {
  assertBranchAreaAccess,
  type BranchArea,
} from "@/lib/auth/assert-branch-area-access";

export function createSettingsAreaLayout(area: BranchArea) {
  return async function SettingsAreaLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    await assertBranchAreaAccess(area);
    return children;
  };
}
