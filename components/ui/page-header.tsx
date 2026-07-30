import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { BranchStickyHeader } from "@/components/layout/branch-sticky-header";
import { cn } from "@/lib/utils";

const pageHeaderVariants = cva("", {
  variants: {
    variant: {
      default: "",
      centered: "",
      compact: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface PageHeaderProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof pageHeaderVariants> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  badge?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

/**
 * En-tête page branche — sticky compact (identique Devoirs / BranchStickyHeader).
 */
const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      className,
      variant: _variant,
      title,
      description,
      actions,
      breadcrumbs: _breadcrumbs,
      badge,
      backHref,
      backLabel,
    },
    _ref,
  ) => {
    return (
      <BranchStickyHeader
        title={title}
        description={description}
        badge={badge}
        actions={actions}
        backHref={backHref}
        backLabel={backLabel}
        className={cn(pageHeaderVariants(), className)}
      />
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
      "text-base font-bold tracking-tight text-foreground md:text-lg",
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
      "text-xs leading-snug text-muted-foreground md:text-sm",
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
