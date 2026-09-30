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
  amber: "bg-amber-700 text-white",
  emerald: "bg-emerald-800 text-white",
  rose: "bg-rose-800 text-white",
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
      <code className="mt-1 block w-fit max-w-full break-all rounded-md bg-amber-100 px-2.5 py-1.5 font-mono text-[13px] font-semibold tracking-wide text-amber-950 ring-1 ring-amber-300/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-700/60">
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
        "overflow-hidden rounded-xl border border-slate-200/80 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50",
        className,
      )}
    >
      <div className={cn("px-3 py-2.5", TONE_HEADER[tone])}>
        {card.brand ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] opacity-85">
            {card.brand}
          </p>
        ) : null}
        <p className="text-sm font-semibold leading-snug">{card.title}</p>
      </div>

      <div className="space-y-3 px-3 py-3">
        {card.intro ? (
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {card.intro}
          </p>
        ) : null}

        {card.rows?.length ? (
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/80">
            {card.rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className={cn(
                  row.kind === "secret" &&
                    "rounded-lg border border-amber-200/80 bg-amber-50/80 p-2.5 dark:border-amber-800/50 dark:bg-amber-950/30",
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
            className="inline-flex items-center justify-center rounded-xl bg-[#172554] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#1e3a8a]"
          >
            {card.cta.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
