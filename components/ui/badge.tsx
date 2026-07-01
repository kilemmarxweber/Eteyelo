import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-white shadow-sm hover:bg-destructive/90",
        success:
          "border-transparent bg-success text-white shadow-sm hover:bg-success/90",
        warning:
          "border-transparent bg-warning text-white shadow-sm hover:bg-warning/90",
        info: "border-transparent bg-info text-white shadow-sm hover:bg-info/90",
        outline: "border-2 border-border text-foreground hover:bg-muted/50",
        "outline-primary":
          "border-2 border-primary text-primary hover:bg-primary/10",
        "outline-destructive":
          "border-2 border-destructive text-destructive hover:bg-destructive/10",
        "outline-success":
          "border-2 border-success text-success hover:bg-success/10",
        ghost: "text-foreground hover:bg-muted/80",
        dot: "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        gradient:
          "border-transparent bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm hover:shadow-md",
      },
      size: {
        xs: "px-1.5 py-0.5 text-xs rounded-md",
        sm: "px-2 py-1 text-xs rounded-md",
        default: "px-2.5 py-1 text-sm rounded-lg",
        lg: "px-3 py-1.5 text-sm rounded-lg",
        xl: "px-4 py-2 text-base rounded-xl",
      },
      shape: {
        default: "",
        pill: "rounded-full",
        square: "rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, shape, dot, icon, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size, shape }), className)}
        {...props}
      >
        {dot && (
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-75" />
        )}
        {icon && <span className="mr-1 flex items-center">{icon}</span>}
        {children}
      </div>
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
