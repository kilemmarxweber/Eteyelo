"use client";

import * as React from "react";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  HeaderContext,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Table as TanstackTable,
  Row,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponsiveDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  ToolbarComponent: React.ComponentType<{ table: TanstackTable<TData> }>;
  emptyText: string;
  mobileCardTitle?: (row: TData) => string;
  mobileCardSubtitle?: (row: TData) => string;
  mobileCardActions?: (row: TData) => React.ReactNode;
  mobileCardBadges?: (
    row: TData,
  ) => {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  }[];
  onRowClick?: (row: TData) => void;
  className?: string;
  initialColumnVisibility?: VisibilityState;
  /** Lignes visibles (filtrées + triées, avant pagination). */
  onFilteredRowsChange?: (rows: TData[]) => void;
  getRowId?: (originalRow: TData, index: number) => string;
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
}

function extractReactText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") {
    return String(node).trim();
  }
  if (Array.isArray(node)) {
    return node.map(extractReactText).filter(Boolean).join(" ").trim();
  }
  if (React.isValidElement(node)) {
    const props = node.props as {
      title?: unknown;
      children?: React.ReactNode;
    };
    if (typeof props.title === "string" && props.title.trim()) {
      return props.title.trim();
    }
    return extractReactText(props.children);
  }
  return "";
}

function getMobileColumnLabel<TData, TValue>(
  column: Column<TData, TValue>,
): string {
  const meta = column.columnDef.meta as { label?: string } | undefined;
  if (meta?.label?.trim()) return meta.label.trim();

  const headerDef = column.columnDef.header;
  if (typeof headerDef === "string") return headerDef;

  if (typeof headerDef === "function") {
    try {
      const rendered = headerDef({
        column,
      } as HeaderContext<TData, TValue>);
      const text = extractReactText(rendered);
      if (text) return text;
      if (rendered == null) return "";
    } catch {
      // En-tête complexe (tri, checkbox…) : repli sur l'id.
    }
  }

  const id = column.id ?? "";
  if (!id || id === "select" || id === "actions") return "";
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());
}

const MOBILE_TITLE_COLUMN_IDS = new Set([
  "nom",
  "name",
  "fullName",
  "postnom",
  "prenom",
  "firstname",
]);

export function ResponsiveDataTable<TData, TValue>({
  columns,
  data,
  emptyText,
  ToolbarComponent,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardActions,
  mobileCardBadges,
  onRowClick,
  className,
  initialColumnVisibility,
  onFilteredRowsChange,
  getRowId,
  enableRowSelection = true,
}: ResponsiveDataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility ?? {});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [isMobile, setIsMobile] = React.useState(false);

  // Détection responsive
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection,
    getRowId,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const onFilteredRowsChangeRef = React.useRef(onFilteredRowsChange);
  onFilteredRowsChangeRef.current = onFilteredRowsChange;

  const visibleRowsKey = [
    data.length,
    JSON.stringify(columnFilters),
    JSON.stringify(sorting),
    table
      .getSortedRowModel()
      .rows.map((row) => row.id)
      .join("|"),
  ].join("::");

  // Sync without useEffect so HMR cannot change the deps array length.
  const lastVisibleRowsKeyRef = React.useRef<string | null>(null);
  if (lastVisibleRowsKeyRef.current !== visibleRowsKey) {
    lastVisibleRowsKeyRef.current = visibleRowsKey;
    const rows = table.getSortedRowModel().rows.map((row) => row.original);
    queueMicrotask(() => {
      onFilteredRowsChangeRef.current?.(rows);
    });
  }

  function handleRowNavigate(
    event: React.MouseEvent<HTMLElement>,
    row: TData,
  ) {
    if (!onRowClick) return;

    const target = event.target as HTMLElement;
    if (
      target.closest(
        'button, a, input, label, [role="checkbox"], [role="menuitem"], [data-no-row-nav="true"]',
      )
    ) {
      return;
    }

    onRowClick(row);
  }

  // Inline JSX (not nested components) so score/comment edits don't remount inputs.
  const hasSelectColumn = table
    .getAllColumns()
    .some((column) => column.id === "select");

  return (
    <div className={cn("space-y-4", className)}>
      <ToolbarComponent table={table} />

      {isMobile ? (
        <div className="space-y-4">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const rowData = row.original as TData;
              return (
                <Card
                  key={row.id}
                  className={cn(
                    "transition-all hover:shadow-md",
                    onRowClick && "cursor-pointer",
                    row.getIsSelected() && "ring-1 ring-primary/40",
                  )}
                  onClick={(event) => handleRowNavigate(event, rowData)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      {hasSelectColumn ? (
                        <Checkbox
                          checked={row.getIsSelected()}
                          disabled={!row.getCanSelect()}
                          onCheckedChange={(value) =>
                            row.toggleSelected(!!value)
                          }
                          aria-label="Sélectionner"
                          className="mt-1"
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold truncate">
                          {mobileCardTitle
                            ? mobileCardTitle(rowData)
                            : `Item ${row.id}`}
                        </CardTitle>
                        {mobileCardSubtitle && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {mobileCardSubtitle(rowData)}
                          </p>
                        )}
                      </div>
                      {mobileCardActions ? mobileCardActions(rowData) : null}
                    </div>

                    {mobileCardBadges && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {mobileCardBadges(rowData).map((badge, index) => (
                          <Badge
                            key={index}
                            variant={badge.variant || "secondary"}
                          >
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {row.getVisibleCells().map((cell) => {
                        const column = cell.column;
                        const columnDef = column.columnDef;

                        const columnId = column.id ?? columnDef.id;
                        if (columnId === "actions" || columnId === "select") {
                          return null;
                        }
                        if (
                          mobileCardTitle &&
                          columnId &&
                          MOBILE_TITLE_COLUMN_IDS.has(columnId)
                        ) {
                          return null;
                        }

                        const label = getMobileColumnLabel(column);
                        if (!label) return null;

                        return (
                          <div
                            key={cell.id}
                            className="flex items-start justify-between gap-3 py-1.5"
                          >
                            <span className="shrink-0 text-sm font-medium text-muted-foreground">
                              {label}
                            </span>
                            <div className="min-w-0 flex-1 text-right text-sm">
                              {flexRender(columnDef.cell, cell.getContext())}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {mobileCardActions && (
                      <div className="flex gap-2 mt-4 pt-3 border-t">
                        {mobileCardActions(rowData)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-32">
                <p className="text-muted-foreground text-center">{emptyText}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      onRowClick && "cursor-pointer",
                    )}
                    onClick={(event) => handleRowNavigate(event, row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {emptyText}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} sur{" "}
          {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s).
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </Button>
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium">Page</span>
            <span className="text-sm">
              {table.getState().pagination.pageIndex + 1} sur{" "}
              {table.getPageCount()}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
