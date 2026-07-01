import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-lg border bg-background px-4 py-2.5 text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input hover:border-ring/50 focus-visible:border-ring",
        filled:
          "border-transparent bg-muted hover:bg-muted/80 focus-visible:bg-background focus-visible:border-ring",
        flushed:
          "rounded-none border-0 border-b-2 border-input px-0 hover:border-ring/50 focus-visible:border-ring",
        success:
          "border-success hover:border-success/80 focus-visible:border-success focus-visible:ring-success/20",
        warning:
          "border-warning hover:border-warning/80 focus-visible:border-warning focus-visible:ring-warning/20",
        destructive:
          "border-destructive hover:border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/20",
      },
      inputSize: {
        sm: "h-8 px-3 py-1.5 text-xs",
        default: "h-10 px-4 py-2.5",
        lg: "h-12 px-5 py-3 text-base",
        xl: "h-14 px-6 py-4 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  error?: boolean;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      inputSize,
      startIcon,
      endIcon,
      error,
      helperText,
      ...props
    },
    ref
  ) => {
    // Si error est true, on utilise la variante destructive
    const finalVariant = error ? "destructive" : variant;

    return (
      <div className="relative w-full">
        {startIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {startIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            inputVariants({ variant: finalVariant, inputSize }),
            startIcon && "pl-10",
            endIcon && "pr-10",
            className
          )}
          ref={ref}
          {...props}
        />
        {endIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {endIcon}
          </div>
        )}
        {helperText && (
          <p
            className={cn(
              "mt-1.5 text-xs",
              error ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
