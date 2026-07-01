"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchBranchAction } from "./branche.action";

interface BranchCardProps {
  branchId: string;
  href: string;
  children: React.ReactNode;
}

export function BranchCard({ branchId, href, children }: BranchCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await switchBranchAction(branchId);

      router.push(href);
      router.refresh();
    });
  };

  return (
    <div
      onClick={handleClick}
      className={pending ? "pointer-events-none opacity-50" : ""}
    >
      {children}
    </div>
  );
}
