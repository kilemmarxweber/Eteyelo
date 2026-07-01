import { redirect } from "next/navigation";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";

import Cours from "./components/coursClient";

export default async function Page() {
  const { session } = await requireBranchContext();

  if (!canAccessTeachingArea(session)) {
    redirect("/not-authorized");
  }

  return <Cours />;
}
