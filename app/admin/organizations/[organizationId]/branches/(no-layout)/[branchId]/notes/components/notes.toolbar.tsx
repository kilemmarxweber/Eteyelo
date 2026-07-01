"use client";

import { Table } from "@tanstack/react-table";

export function NotesToolbar({ table }: { table: Table<any> }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {table.getFilteredRowModel().rows.length} élèves
      </div>
    </div>
  );
}
