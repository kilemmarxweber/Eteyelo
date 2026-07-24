import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Props historiques encore utilisées dans les pages branche.
 * Avant le build, `variant` / `padding` étaient ignorés (spread DOM) :
 * on conserve l’API pour TypeScript, avec un impact visuel minimal
 * aligné sur le rendu d’origine (base + className).
 */
type CardVariant = "default" | "elevated" | "stat" | "outline";
type CardPadding = "none" | "sm" | "md" | "default" | "lg" | "xl";

const cardVariantClass: Record<CardVariant, string> = {
  default: "",
  elevated: "shadow-md",
  /** Cartes KPI compactes — gérées dans le composant (évite conflit py-6) */
  stat: "",
  outline: "bg-transparent shadow-none",
};

const cardPaddingClass: Record<CardPadding, string> = {
  none: "gap-0 py-0",
  sm: "gap-0 p-3",
  md: "gap-0 p-4",
  default: "",
  lg: "",
  xl: "",
};

function Card({
  className,
  variant = "default",
  padding = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: CardVariant;
  padding?: CardPadding;
}) {
  const isStat = variant === "stat";

  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm",
        isStat ? "h-full gap-0 p-4" : "gap-6 py-6",
        !isStat && cardVariantClass[variant],
        cardPaddingClass[padding],
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
