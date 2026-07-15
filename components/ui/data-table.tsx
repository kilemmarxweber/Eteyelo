"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<TData>({
  columns,
  data,
  className,
  onRowClick,
  selectedRowId,
  getRowId,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  className?: string;
  onRowClick?: (row: TData) => void;
  selectedRowId?: string;
  getRowId?: (row: TData) => string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table className={className ?? "min-w-[700px]"}>
      <TableHeader className="bg-muted/50">
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="h-10">
            {hg.headers.map((h) => {
              const meta = h.column.columnDef.meta as ColumnMeta | undefined;
              return (
                <TableHead
                  key={h.id}
                  className={cn(
                    "whitespace-nowrap py-2 text-xs md:text-sm",
                    meta?.headerClassName,
                  )}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>

      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const rowId = getRowId
              ? getRowId(row.original)
              : (row.original as any).id;
            const isSelected =
              selectedRowId !== undefined && rowId === selectedRowId;

            return (
              <TableRow
                key={row.id}
                className={`h-10 transition hover:bg-muted/30 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                data-state={isSelected ? "selected" : undefined}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | ColumnMeta
                    | undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "whitespace-nowrap py-2 text-xs md:text-sm",
                        meta?.cellClassName,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length || 1}
              className="h-24 whitespace-normal px-4 py-10 text-center text-sm leading-relaxed text-muted-foreground"
            >
              Aucune donnée
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
