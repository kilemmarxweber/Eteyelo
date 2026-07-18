"use client";

import Link from "next/link";
import { IconBook, IconChevronRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BranchTypeHelpContent } from "@/lib/branch-type-help";

type BranchTypeHelpPanelProps = {
  content: BranchTypeHelpContent;
  branchBasePath: string;
};

export function BranchTypeHelpPanel({
  content,
  branchBasePath,
}: BranchTypeHelpPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="outline-primary" icon={<IconBook size={14} />}>
              {content.typeLabel}
            </Badge>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              {content.summary}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {content.sections.map((section) => (
          <Card key={section.title} className="rounded-2xl border p-5">
            <h3 className="font-semibold text-foreground">{section.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {content.quickLinks.length ? (
        <Card className="rounded-2xl border p-5">
          <h3 className="font-semibold text-foreground">Raccourcis utiles</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {content.quickLinks.map((link) => (
              <Link
                key={link.href}
                href={`${branchBasePath}${link.href.replace("/admin", "")}`}
                className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition hover:bg-muted/50"
              >
                <span>{link.label}</span>
                <IconChevronRight size={16} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
