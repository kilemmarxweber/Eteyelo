"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { IconLoader2 } from "@tabler/icons-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30",
        destructive:
          "bg-destructive text-white shadow-lg shadow-destructive/25 hover:bg-destructive/90 hover:shadow-xl hover:shadow-destructive/30",
        success:
          "bg-success text-white shadow-lg shadow-success/25 hover:bg-success/90 hover:shadow-xl hover:shadow-success/30",
        warning:
          "bg-warning text-white shadow-lg shadow-warning/25 hover:bg-warning/90 hover:shadow-xl hover:shadow-warning/30",
        outline:
          "border-2 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/20",
        "outline-destructive":
          "border-2 border-destructive bg-background text-destructive hover:bg-destructive hover:text-white hover:shadow-lg hover:shadow-destructive/20",
        secondary:
          "bg-secondary text-secondary-foreground shadow-md hover:bg-secondary/80 hover:shadow-lg",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:shadow-md",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        gradient:
          "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]",
      },
      size: {
        xs: "h-7 px-2 text-xs rounded-md",
        sm: "h-8 px-3 text-xs rounded-md",
        default: "h-10 px-4 py-2",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-8 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      children,
      disabled,
      loading = false,
      leftSection,
      rightSection,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // Quand asChild=true, Radix Slot ne tolère qu'un seul enfant React.
    // leftSection/rightSection/loading n'ont pas de sens sur un élément externe
    // (ex: <Link>), donc on transmet uniquement children au Slot.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={loading || disabled}
        ref={ref}
        {...props}
      >
        {((leftSection && loading) ||
          (!leftSection && !rightSection && loading)) && (
          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {!loading && leftSection && <div className="mr-2">{leftSection}</div>}
        {children}
        {!loading && rightSection && <div className="ml-2">{rightSection}</div>}
        {rightSection && loading && (
          <IconLoader2 className="ml-2 h-4 w-4 animate-spin" />
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
