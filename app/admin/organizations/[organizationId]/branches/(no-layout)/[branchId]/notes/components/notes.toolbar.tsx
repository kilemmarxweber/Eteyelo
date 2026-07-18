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
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {table.getFilteredRowModel().rows.length} {studentPlural}
      </div>
    </div>
  );
}
