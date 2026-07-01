import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const gridVariants = cva("grid w-full", {
  variants: {
    cols: {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
      5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
      6: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
      auto: "grid-cols-[repeat(auto-fit,minmax(250px,1fr))]",
    },
    gap: {
      none: "gap-0",
      sm: "gap-2",
      default: "gap-4",
      md: "gap-6",
      lg: "gap-8",
      xl: "gap-12",
    },
  },
  defaultVariants: {
    cols: 1,
    gap: "default",
  },
});

export interface GridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols, gap, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(gridVariants({ cols, gap }), className)}
      {...props}
    />
  )
);
Grid.displayName = "Grid";

const GridItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | "full";
    rowSpan?: 1 | 2 | 3 | 4 | 5 | 6;
  }
>(({ className, colSpan, rowSpan, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      colSpan === 1 && "col-span-1",
      colSpan === 2 && "col-span-1 md:col-span-2",
      colSpan === 3 && "col-span-1 md:col-span-2 lg:col-span-3",
      colSpan === 4 && "col-span-1 md:col-span-2 lg:col-span-4",
      colSpan === 5 && "col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-5",
      colSpan === 6 && "col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-6",
      colSpan === "full" && "col-span-full",
      rowSpan === 1 && "row-span-1",
      rowSpan === 2 && "row-span-2",
      rowSpan === 3 && "row-span-3",
      rowSpan === 4 && "row-span-4",
      rowSpan === 5 && "row-span-5",
      rowSpan === 6 && "row-span-6",
      className
    )}
    {...props}
  />
));
GridItem.displayName = "GridItem";

export { Grid, GridItem, gridVariants };
