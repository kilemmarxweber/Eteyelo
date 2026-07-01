"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
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
  className?: string;
}

export function ResponsiveDataTable<TData, TValue>({
  columns,
  data,
  emptyText,
  ToolbarComponent,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardActions,
  mobileCardBadges,
  className,
}: ResponsiveDataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
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
    enableRowSelection: true,
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

  // Vue mobile - Cards
  const MobileCardView = () => (
    <div className="space-y-4">
      {table.getRowModel().rows?.length ? (
        table.getRowModel().rows.map((row) => {
          const rowData = row.original as TData;
          return (
            <Card key={row.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        Voir
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Badges */}
                {mobileCardBadges && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {mobileCardBadges(rowData).map((badge, index) => (
                      <Badge key={index} variant={badge.variant || "secondary"}>
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                {/* Détails des colonnes */}
                <div className="space-y-3">
                  {row.getVisibleCells().map((cell) => {
                    const column = cell.column;
                    const columnDef = column.columnDef;

                    // Ignorer les colonnes d'actions et de sélection en mobile
                    if (
                      columnDef.id === "actions" ||
                      columnDef.id === "select"
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={cell.id}
                        className="flex justify-between items-center py-1"
                      >
                        <span className="text-sm font-medium text-muted-foreground capitalize">
                          {typeof columnDef.header === "string"
                            ? columnDef.header
                            : columnDef.id?.replace(/([A-Z])/g, " $1").trim() ||
                              "Champ"}
                          :
                        </span>
                        <span className="text-sm text-right flex-1 ml-2">
                          {flexRender(columnDef.cell, cell.getContext())}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions personnalisées */}
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
  );

  // Vue desktop - Tableau classique
  const DesktopTableView = () => (
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
                className="hover:bg-muted/50 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      <ToolbarComponent table={table} />

      {/* Affichage conditionnel selon la taille d'écran */}
      {isMobile ? <MobileCardView /> : <DesktopTableView />}

      {/* Pagination - toujours visible */}
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
