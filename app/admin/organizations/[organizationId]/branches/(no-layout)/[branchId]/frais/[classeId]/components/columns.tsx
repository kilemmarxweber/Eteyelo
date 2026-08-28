"use client";

import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UpdateFraisDialog } from "./edit-Frais-dialog";
import { DeleteFraissDialog } from "./delete-Frais-dialog";

import React from "react";
import { IFrais } from "@/src/interfaces/Frais";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { useSession } from "@/lib/auth-client";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";

export const columns: ColumnDef<IFrais>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "nameFrais",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Intitulé du frais" />
    ),
    cell: ({ row }) => {
      return row.original.nameFrais ?? "N/A";
    },
  },
  {
    accessorKey: "montantFrais",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Montant" />
    ),
    cell: ({ row }) => {
      return row.original.montantFrais ?? "N/A";
    },
  },
  
  
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="inscris le " />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const { data: session, isPending: sessionPending } = useSession();
      const [hasMounted, setHasMounted] = React.useState(false);
      const canPurgePermanently =
        hasMounted &&
        !sessionPending &&
        isOrganizationOwnerSession(session);
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showPurgeTaskDialog, setShowPurgeTaskDialog] =
        React.useState(false);

      React.useEffect(() => {
        setHasMounted(true);
      }, []);

      return (
        <>
          <UpdateFraisDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            frais={row.original}
          />
          
          <DeleteFraissDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            Frais={[row.original]}
            showTrigger={false}
            onSuccess={() => row.toggleSelected(false)}
          />
          {canPurgePermanently ? (
            <DeleteFraissDialog
              open={showPurgeTaskDialog}
              onOpenChange={setShowPurgeTaskDialog}
              Frais={[row.original]}
              showTrigger={false}
              permanent
              onSuccess={() => row.toggleSelected(false)}
            />
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0 data-[state=open]:bg-muted"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => setShowUpdateTaskSheet(true)}>
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowDeleteTaskDialog(true)}>
                Désactiver
                <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
              {canPurgePermanently ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setShowPurgeTaskDialog(true)}
                >
                  Supprimer
                  <DropdownMenuShortcut>⇧Del</DropdownMenuShortcut>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
