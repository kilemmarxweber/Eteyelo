import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type BackLinkProps = {
  href: string;
  label: string;
  className?: string;
};

export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex w-fit max-w-full items-center gap-2.5 self-start rounded-xl border border-border/80 bg-background/80 px-2.5 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        "hover:-translate-x-1 hover:border-primary/35 hover:bg-primary/5 hover:text-foreground hover:shadow-md",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg",
          "bg-muted text-foreground/70",
          "transition-all duration-300 ease-out",
          "group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-sm",
        )}
      >
        <IconArrowLeft
          size={15}
          stroke={2}
          className="transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
        />
      </span>
      <span className="pr-1.5 transition-colors duration-300">{label}</span>
    </Link>
  );
}
