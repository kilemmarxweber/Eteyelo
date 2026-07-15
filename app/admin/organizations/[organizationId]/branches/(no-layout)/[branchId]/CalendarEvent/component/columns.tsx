"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ICalendarEvent } from "@/src/interfaces/CalendarEvent";
import { Button } from "@/components/custom/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconDots } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import React from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { EventActions } from "./EventActions";

export const columns: ColumnDef<ICalendarEvent>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  },

  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Titre" />
    ),
    cell: ({ row }) => row.original.title ?? "N/A",
  },

  {
    accessorKey: "dateStart",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Début" />
    ),
    cell: ({ row }) => new Date(row.original.dateStart).toLocaleString("fr-FR"),
  },

  {
    accessorKey: "dateEnd",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fin" />
    ),
    cell: ({ row }) =>
      row.original.dateEnd
        ? new Date(row.original.dateEnd).toLocaleString("fr-FR")
        : "—",
  },

  {
    accessorKey: "recurrence",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Récurrence" />
    ),
    cell: ({ row }) => row.original.recurrence ?? "—",
  },

  {
    accessorKey: "location",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lieu" />
    ),
    cell: ({ row }) => row.original.location ?? "—",
  },

  {
    id: "actions",
    cell: ({ row }) => {
      <EventActions id={row.original.id} />;
    },
  },
];
