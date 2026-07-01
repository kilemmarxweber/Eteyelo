import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const pageHeaderVariants = cva("flex flex-col space-y-4 pb-6", {
  variants: {
    variant: {
      default: "",
      centered: "text-center items-center",
      compact: "space-y-2 pb-4",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface PageHeaderProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pageHeaderVariants> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  badge?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      className,
      variant,
      title,
      description,
      actions,
      breadcrumbs,
      badge,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(pageHeaderVariants({ variant }), className)}
        {...props}
      >
        {breadcrumbs && (
          <div className="flex items-center text-sm text-muted-foreground">
            {breadcrumbs}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
                {title}
              </h1>
              {badge && badge}
            </div>
            {description && (
              <p className="text-base text-muted-foreground leading-relaxed ">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  },
);
PageHeader.displayName = "PageHeader";

const PageHeaderTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn(
      "text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl",
      className,
    )}
    {...props}
  />
));
PageHeaderTitle.displayName = "PageHeaderTitle";

const PageHeaderDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-base text-muted-foreground leading-relaxed max-w-2xl",
      className,
    )}
    {...props}
  />
));
PageHeaderDescription.displayName = "PageHeaderDescription";

const PageHeaderActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}
    {...props}
  />
));
PageHeaderActions.displayName = "PageHeaderActions";

export {
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  pageHeaderVariants,
};
