"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { switchBranchAction } from "./branche.action";

interface BranchCardProps {
  branchId: string;
  href: string;
  editHref: string;
  children: React.ReactNode;
}

export function BranchCard({
  branchId,
  href,
  editHref,
  children,
}: BranchCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await switchBranchAction(branchId);
      router.push(href);
      router.refresh();
    });
  };

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleClick}
      className={`group cursor-pointer ${
        pending ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="relative">
        {children}

        <div
          className="absolute bottom-5 right-5 z-20 flex items-center gap-2"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Button
            asChild
            size="icon"
            variant="outline"
            className="rounded-full"
          >
            <Link href={editHref}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            size="icon"
            variant="destructive"
            className="rounded-full"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
