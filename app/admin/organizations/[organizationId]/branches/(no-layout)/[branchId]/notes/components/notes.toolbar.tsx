"use client";

import { Table } from "@tanstack/react-table";

type NotesToolbarProps = {
  table: Table<any>;
  studentPlural?: string;
};

export function NotesToolbar({
  table,
  studentPlural = "élèves",
}: NotesToolbarProps) {
  return (
    <div className="mb-1 flex items-center justify-between py-0">
      <div className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} {studentPlural}
      </div>
    </div>
  );
}
