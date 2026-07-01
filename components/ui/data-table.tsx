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
            {hg.headers.map((h) => (
              <TableHead
                key={h.id}
                className="whitespace-nowrap text-xs md:text-sm py-2"
              >
                {flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
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
                className={`hover:bg-muted/30 transition h-10 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                data-state={isSelected ? "selected" : undefined}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="whitespace-nowrap text-xs md:text-sm py-2"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="text-center text-muted-foreground py-6"
            >
              Aucune donnée
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
