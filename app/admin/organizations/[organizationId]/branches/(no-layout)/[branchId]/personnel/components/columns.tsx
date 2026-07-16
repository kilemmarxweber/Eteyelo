"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { IPersonnel } from "@/src/interfaces/Personnel";

import { ResetUsersDialog } from "../../student/components/reset-users-dialog";
import { AddPersonnelRole } from "./add-personnelrole-dialog";
import { DeletePersonalDialog } from "./delete-personal-dialog";
import { DetailsPersonnelDialog } from "./details-personnel-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export type PersonnelTableActions = {
  onEdit: (personnel: IPersonnel) => void;
};

export const createPersonnelColumns = (
  onRefresh?: () => void,
  canManagePersonnel = true,
  actions?: PersonnelTableActions,
): ColumnDef<IPersonnel>[] => [
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
    id: "photo",
    header: "PHOTO",
    cell: ({ row }) => {
      const personnel = row.original;
      const initials =
        `${personnel.nom?.[0] ?? ""}${personnel.prenom?.[0] ?? ""}`.toUpperCase() ||
        "PE";

      return (
        <div className="flex items-center justify-center">
          <div className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-border bg-blue-50 ring-2 ring-white">
            <span className="text-sm font-black text-primary">{initials}</span>
          </div>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "nom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom" />
    ),
    cell: ({ row }) => (
      <span className="font-semibold text-foreground">
        {row.original.nom ?? "N/A"}
      </span>
    ),
    filterFn: (row, id, value) => {
      const search = String(value).toLowerCase().trim();
      const nom = String(row.getValue(id) ?? "").toLowerCase();
      const postnom = String(row.getValue("postnom") ?? "").toLowerCase();
      const prenom = String(row.getValue("prenom") ?? "").toLowerCase();

      return (
        nom.includes(search) ||
        postnom.includes(search) ||
        prenom.includes(search)
      );
    },
  },
  {
    accessorKey: "postnom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Postnom" />
    ),
    cell: ({ row }) => (
      <span className="text-foreground/80">{row.original.postnom ?? "N/A"}</span>
    ),
  },
  {
    accessorKey: "prenom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prénom" />
    ),
    cell: ({ row }) => (
      <span className="text-foreground/80">{row.original.prenom ?? "N/A"}</span>
    ),
  },
  {
    accessorKey: "sexe",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sexe" />
    ),
    cell: ({ row }) => {
      const sexe = row.original.sexe;
      if (sexe === "M") return "Masculin";
      if (sexe === "F") return "Féminin";
      return sexe ?? "N/A";
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: "role",
    accessorFn: (row) => row.role ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Rôle" />
    ),
    cell: ({ row }) => (
      <span className="font-medium text-primary">
        {row.original.role ? orgRoleLabel(row.original.role) : "Non défini"}
      </span>
    ),
  },
  {
    accessorKey: "telephone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Téléphone" />
    ),
    cell: ({ row }) =>
      row.original.telephone ? (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`tel:${row.original.telephone}`}
        >
          {row.original.telephone}
        </Link>
      ) : (
        "N/A"
      ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),
    cell: ({ row }) =>
      row.original.email ? (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`mailto:${row.original.email}`}
        >
          {row.original.email}
        </Link>
      ) : (
        "N/A"
      ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showPersonnalRoleSheet, setShowPersonnalRoleSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);

      const params = useParams<{ organizationId: string; branchId: string }>();
      const personnel = row.original;

      const handleSuccess = () => {
        row.toggleSelected(false);
        onRefresh?.();
      };

      return (
        <>
          {canManagePersonnel ? (
            <>
              <AddPersonnelRole
                open={showPersonnalRoleSheet}
                onOpenChange={setShowPersonnalRoleSheet}
                personnel={personnel}
                onSuccess={handleSuccess}
              />
              <DeletePersonalDialog
                open={showDeleteTaskDialog}
                onOpenChange={setShowDeleteTaskDialog}
                personals={[personnel]}
                showTrigger={false}
                onSuccess={handleSuccess}
              />
              <ResetUsersDialog
                open={showResetTaskDialog}
                onOpenChange={setShowResetTaskDialog}
                email={personnel.email || ""}
                organizationId={params.organizationId}
                showTrigger={false}
                onSuccess={handleSuccess}
              />
            </>
          ) : null}

          <DetailsPersonnelDialog
            open={showDetailsTaskDialog}
            onOpenChange={setShowDetailsTaskDialog}
            personnel={personnel}
          />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0 text-foreground hover:bg-blue-50 data-[state=open]:bg-blue-50"
              >
                <IconDots className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                Détails
              </DropdownMenuItem>

              {canManagePersonnel ? (
                <>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      if (!actions) return;
                      openOverlayAfterMenuDismiss(() =>
                        actions.onEdit(personnel),
                      );
                    }}
                  >
                    Modifier
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => setShowPersonnalRoleSheet(true)}
                  >
                    Affecter un rôle
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    Réinitialiser
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={() => setShowDeleteTaskDialog(true)}
                  >
                    Archiver
                    <DropdownMenuShortcut>Del</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
