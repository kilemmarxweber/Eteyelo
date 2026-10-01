"use client";

import { ExternalLink, KeyRound, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseNotifyCard,
  type NotifyCardRow,
  type NotifyMessageCard,
} from "@/lib/notify/notify-message-card";

const TONE_HEADER: Record<
  NonNullable<NotifyMessageCard["tone"]>,
  string
> = {
  navy: "bg-[#172554] text-white",
  amber: "bg-amber-800 text-white",
  emerald: "bg-emerald-800 text-white",
  rose: "bg-rose-800 text-white",
};

const TONE_CTA: Record<NonNullable<NotifyMessageCard["tone"]>, string> = {
  navy: "bg-[#172554] hover:bg-[#1e3a8a]",
  amber: "bg-amber-800 hover:bg-amber-900",
  emerald: "bg-emerald-800 hover:bg-emerald-900",
  rose: "bg-rose-800 hover:bg-rose-900",
};

function RowIcon({ kind }: { kind?: NotifyCardRow["kind"] }) {
  if (kind === "secret") return <KeyRound className="size-3.5 shrink-0" />;
  if (kind === "email") return <Mail className="size-3.5 shrink-0" />;
  if (kind === "phone") return <Phone className="size-3.5 shrink-0" />;
  if (kind === "link") return <ExternalLink className="size-3.5 shrink-0" />;
  return null;
}

function RowValue({ row }: { row: NotifyCardRow }) {
  if (row.kind === "secret") {
    return (
      <code className="mt-1 block w-full max-w-full break-all rounded-lg bg-white px-3 py-2 font-mono text-[14px] font-semibold tracking-wide text-amber-950 ring-1 ring-amber-300 dark:bg-slate-950 dark:text-amber-100 dark:ring-amber-700/70">
        {row.value}
      </code>
    );
  }
  if (row.kind === "link") {
    return (
      <a
        href={row.value}
        target="_blank"
        rel="noreferrer"
        className="mt-0.5 block break-all text-[13px] font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
      >
        {row.value.replace(/^https?:\/\//, "").replace(/\/$/, "") || row.value}
      </a>
    );
  }
  if (row.kind === "email") {
    return (
      <a
        href={`mailto:${row.value}`}
        className="mt-0.5 block break-all text-[13px] font-medium text-slate-800 dark:text-slate-100"
      >
        {row.value}
      </a>
    );
  }
  if (row.kind === "phone") {
    return (
      <a
        href={`tel:${row.value}`}
        className="mt-0.5 block text-[13px] font-medium text-slate-800 dark:text-slate-100"
      >
        {row.value}
      </a>
    );
  }
  return (
    <span className="mt-0.5 block break-words text-[13px] font-medium text-slate-800 dark:text-slate-100">
      {row.value}
    </span>
  );
}

export function MessageNotifyCard({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const card = parseNotifyCard(body);
  if (!card) {
    return (
      <p className={cn("whitespace-pre-wrap break-words", className)}>{body}</p>
    );
  }

  const tone = card.tone ?? "navy";

  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50",
        className,
      )}
    >
      <div className={cn("px-3.5 py-3", TONE_HEADER[tone])}>
        {card.brand ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] opacity-80">
            {card.brand}
          </p>
        ) : null}
        <p className="mt-0.5 text-[15px] font-semibold leading-snug">
          {card.title}
        </p>
      </div>

      <div className="space-y-3 px-3.5 py-3.5">
        {card.intro ? (
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {card.intro}
          </p>
        ) : null}

        {card.rows?.length ? (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/60">
            {card.rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className={cn(
                  "px-3 py-2.5",
                  row.kind === "secret" && "bg-amber-50/90 dark:bg-amber-950/25",
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <RowIcon kind={row.kind} />
                  {row.label}
                </div>
                <RowValue row={row} />
              </div>
            ))}
          </div>
        ) : null}

        {card.note ? (
          <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            {card.note}
          </p>
        ) : null}

        {card.cta ? (
          <a
            href={card.cta.href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex w-full items-center justify-center rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-white transition",
              TONE_CTA[tone],
            )}
          >
            {card.cta.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
