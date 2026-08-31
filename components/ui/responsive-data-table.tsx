"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
} from "lucide-react";
import { TableSkeleton } from "./table-skeleton";
import { EmptyTableState } from "./empty-table-state";
import { cn } from "@/lib/utils";

interface ResponsiveDataTableFooterCell {
  content?: React.ReactNode;
  colSpan?: number;
  className?: string;
}

interface ResponsiveDataTableProps<TData> {
  data: TData[];
  columns: {
    key: string;
    header: React.ReactNode;
    cell: (item: TData) => React.ReactNode;
  }[];
  cardConfig: {
    title: (item: TData) => string;
    subtitle: (item: TData) => string;
    details: (item: TData) => Array<{
      label: string;
      value: React.ReactNode;
    }>;
    actions: (item: TData) => Array<{
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      onClick: () => void;
      variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    }>;
  };
  footer?: {
    cells: ResponsiveDataTableFooterCell[];
    summary?: React.ReactNode;
  };
  loading?: boolean;
  emptyMessage?: string;
  searchTerm?: string;
  getRowId?: (item: TData) => string;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

function TableFooterRow({
  cells,
}: {
  cells: ResponsiveDataTableFooterCell[];
}) {
  return (
    <tfoot className="sticky bottom-0 bg-muted/90 text-sm backdrop-blur-sm">
      <tr className="border-t-2 border-border">
        {cells.map((cell, index) => (
          <td
            key={index}
            colSpan={cell.colSpan}
            className={`p-4 align-middle font-medium ${cell.className ?? ""}`}
          >
            {cell.content}
          </td>
        ))}
      </tr>
    </tfoot>
  );
}

export function ResponsiveDataTable<TData>({
  data,
  columns,
  cardConfig,
  footer,
  loading = false,
  emptyMessage = "Aucune donnée trouvée",
  searchTerm = "",
  getRowId,
  selectedIds,
  onSelectionChange,
}: ResponsiveDataTableProps<TData>) {
  const [isMobile, setIsMobile] = React.useState(false);
  const selectable = Boolean(onSelectionChange);

  const resolveId = React.useCallback(
    (item: TData, index: number) => getRowId?.(item) ?? String(index),
    [getRowId],
  );

  const pageIds = React.useMemo(
    () => data.map((item, index) => resolveId(item, index)),
    [data, resolveId],
  );
  const selectedSet = React.useMemo(
    () => new Set(selectedIds ?? []),
    [selectedIds],
  );
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const somePageSelected = pageIds.some((id) => selectedSet.has(id));

  const toggleAllPage = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(Array.from(new Set([...(selectedIds ?? []), ...pageIds])));
      return;
    }
    const remove = new Set(pageIds);
    onSelectionChange((selectedIds ?? []).filter((id) => !remove.has(id)));
  };

  const toggleOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(Array.from(new Set([...(selectedIds ?? []), id])));
      return;
    }
    onSelectionChange((selectedIds ?? []).filter((current) => current !== id));
  };

  const footerCells =
    selectable && footer?.cells.length
      ? [{ content: null as React.ReactNode }, ...footer.cells]
      : footer?.cells;

  // Détection responsive
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading) {
    return <TableSkeleton />;
  }

  if (data.length === 0) {
    return <EmptyTableState message={emptyMessage} searchTerm={searchTerm} />;
  }

  const selectHeader = (
    <Checkbox
      checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
      onCheckedChange={(value) => toggleAllPage(value === true)}
      aria-label="Tout sélectionner"
    />
  );

  // Vue mobile - Cards
  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((item, index) => {
          const rowId = resolveId(item, index);
          const checked = selectedSet.has(rowId);
          return (
          <Card
            key={rowId}
            className={cn(
              "transition-all hover:shadow-md",
              checked && "ring-1 ring-primary/40",
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                {selectable ? (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleOne(rowId, value === true)}
                    aria-label="Sélectionner"
                    className="mt-1"
                  />
                ) : null}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-semibold truncate">
                    {cardConfig.title(item)}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cardConfig.subtitle(item)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {cardConfig.actions(item).map((action, actionIndex) => (
                      <DropdownMenuItem 
                        key={actionIndex}
                        onClick={action.onClick}
                        className={action.variant === "destructive" ? "text-destructive" : ""}
                      >
                        <action.icon className="mr-2 h-4 w-4" />
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {cardConfig.details(item).map((detail, detailIndex) => (
                  <div key={detailIndex} className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      {detail.label}:
                    </span>
                    <span className="text-sm text-right flex-1 ml-2">
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 mt-4 pt-3 border-t">
                {cardConfig.actions(item).map((action, actionIndex) => (
                  <Button
                    key={actionIndex}
                    variant={action.variant || "outline"}
                    size="sm"
                    onClick={action.onClick}
                    className="flex-1"
                  >
                    <action.icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          );
        })}
        {footer?.summary ??
          (footer?.cells.length ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
              {footer.cells.map((cell, index) =>
                cell.content ? (
                  <span key={index} className={cell.className}>
                    {cell.content}
                  </span>
                ) : null,
              )}
            </div>
          ) : null)}
      </div>
    );
  }

  // Vue desktop - Tableau
  return (
    <div className="rounded-md border">
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              {selectable ? (
                <th className="h-12 w-10 px-4 text-left align-middle [&:has([role=checkbox])]:pr-0">
                  {selectHeader}
                </th>
              ) : null}
              {columns.map((column, index) => (
                <th key={index} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {data.map((item, index) => {
              const rowId = resolveId(item, index);
              const checked = selectedSet.has(rowId);
              return (
              <tr
                key={rowId}
                data-state={checked ? "selected" : undefined}
                className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
              >
                {selectable ? (
                  <td className="w-10 p-4 align-middle [&:has([role=checkbox])]:pr-0">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleOne(rowId, value === true)
                      }
                      aria-label="Sélectionner la ligne"
                    />
                  </td>
                ) : null}
                {columns.map((column, columnIndex) => (
                  <td key={columnIndex} className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                    {column.cell(item)}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
          {footerCells?.length ? <TableFooterRow cells={footerCells} /> : null}
        </table>
      </div>
    </div>
  );
} 