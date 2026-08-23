"use client";

import Link from "next/link";
import {
  IconBook,
  IconBuildingStore,
  IconCheck,
  IconChevronRight,
  IconClipboardList,
  IconDeviceDesktop,
  IconUsers,
} from "@tabler/icons-react";

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
  const manual = content.registrationManual;

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

      {manual ? (
        <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-card to-emerald-50/60 dark:from-sky-950/30 dark:via-card dark:to-emerald-950/20">
          <div className="border-b bg-card/70 px-5 py-5 backdrop-blur sm:px-6">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
                <IconClipboardList size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <Badge variant="outline-primary" icon={<IconBook size={14} />}>
                  Guide pratique
                </Badge>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {manual.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {manual.intro}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {manual.modes.map((mode) => {
                const isOnline = mode.title.toLowerCase().includes("ligne");
                return (
                  <Card
                    key={mode.title}
                    className="rounded-2xl border bg-card/90 p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          isOnline
                            ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                            : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }
                      >
                        {isOnline ? (
                          <IconDeviceDesktop size={20} />
                        ) : (
                          <IconBuildingStore size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {mode.title}
                          </h3>
                          <Badge variant="secondary">{mode.badge}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {mode.description}
                        </p>
                        <ul className="mt-4 space-y-2">
                          {mode.highlights.map((item) => (
                            <li
                              key={item}
                              className="flex gap-2 text-sm text-foreground/90"
                            >
                              <IconCheck
                                size={16}
                                className="mt-0.5 shrink-0 text-emerald-600"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="rounded-2xl border bg-card/90 p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <IconUsers size={18} className="text-sky-700 dark:text-sky-300" />
                <h3 className="font-semibold text-foreground">
                  {manual.counterTitle}
                </h3>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {manual.counterIntro}
              </p>

              <ol className="relative mt-6 space-y-4 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-px before:bg-border">
                {manual.steps.map((step) => (
                  <li key={step.step} className="relative pl-12">
                    <span className="absolute left-0 top-0 flex size-10 items-center justify-center rounded-full border-2 border-sky-600 bg-card text-sm font-bold text-sky-700 shadow-sm dark:text-sky-300">
                      {step.step}
                    </span>
                    <div className="rounded-2xl border bg-muted/30 p-4 sm:p-5">
                      <h4 className="font-semibold text-foreground">
                        {step.title}
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                      {step.tips?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {step.tips.map((tip) => (
                            <span
                              key={tip}
                              className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"
                            >
                              {tip}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>

              {manual.footnote ? (
                <div className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-4 dark:border-amber-900/50 dark:bg-amber-950/30 sm:px-5">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {manual.footnote}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
