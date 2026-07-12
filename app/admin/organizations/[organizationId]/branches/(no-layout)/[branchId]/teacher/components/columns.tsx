"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ITeacher } from "@/src/interfaces/Teacher";

import { ResetUsersDialog } from "../../student/components/reset-users-dialog";
import { DeleteTeacherDialog } from "./delete-teacher-dialog";
import { DetailsTeacherDialog } from "./details-teacher-dialog";
import { UpdateTeacherDialog } from "./edit-teacher-dialog";

export const createTeacherColumns = (
  onRefresh?: () => void,
  canManageTeachers = true,
): ColumnDef<ITeacher>[] => [
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
    accessorKey: "nom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom" />
    ),
    cell: ({ row }) => row.original.nom ?? "N/A",
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
    cell: ({ row }) => row.original.postnom ?? "N/A",
  },
  {
    accessorKey: "prenom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prenom" />
    ),
    cell: ({ row }) => row.original.prenom ?? "N/A",
  },
  {
    accessorKey: "sexe",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sexe" />
    ),
    cell: ({ row }) => row.original.sexe ?? "N/A",
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "assignmentStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Affectation" />
    ),
    cell: ({ row }) => {
      const assigned = row.original.assignmentStatus === "assigned";
      return assigned ? (
        <Badge variant="success">
          Affecte · {row.original.assignmentCount ?? 0}
        </Badge>
      ) : (
        <div className="flex items-center gap-2">
          <Badge variant="warning">Non affecte</Badge>
          {canManageTeachers ? (
            <Button variant="outline" size="xs" asChild>
              <Link href="../teaching">Affecter</Link>
            </Button>
          ) : null}
        </div>
      );
    },
    filterFn: (row, id, value) =>
      Array.isArray(value) ? value.includes(row.getValue(id)) : true,
  },
  {
    id: "classNames",
    accessorFn: (teacher) => teacher.classNames ?? [],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Classes" />
    ),
    cell: ({ row }) => {
      const names = row.original.classNames ?? [];
      return names.length ? (
        <div className="flex max-w-56 flex-wrap gap-1">
          {names.slice(0, 2).map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
          {names.length > 2 ? (
            <Badge variant="secondary">+{names.length - 2}</Badge>
          ) : null}
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
    filterFn: (row, id, value) => {
      const names = row.getValue(id) as string[];
      return Array.isArray(value)
        ? value.some((selected) => names.includes(selected))
        : true;
    },
  },
  {
    id: "courseNames",
    accessorFn: (teacher) => teacher.courseNames ?? [],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cours" />
    ),
    cell: ({ row }) => {
      const names = row.original.courseNames ?? [];
      return names.length ? (
        <div className="flex max-w-56 flex-wrap gap-1">
          {names.slice(0, 2).map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
          {names.length > 2 ? (
            <Badge variant="outline">+{names.length - 2}</Badge>
          ) : null}
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
    filterFn: (row, id, value) => {
      const names = row.getValue(id) as string[];
      return Array.isArray(value)
        ? value.some((selected) => names.includes(selected))
        : true;
    },
  },
  {
    accessorKey: "dateOfBirth",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date creation" />
    ),
    cell: (row) =>
      row.getValue()
        ? new Date(row.getValue() as string).toLocaleDateString()
        : "N/A",
  },
  {
    accessorKey: "telephone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Telephone" />
    ),
    cell: ({ row }) => (
      <Link
        className="text-primary underline-offset-4 hover:underline"
        href={`tel:${row.original.telephone}`}
      >
        {row.original.telephone ?? "N/A"}
      </Link>
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),
    cell: ({ row }) => (
      <Link
        className="text-primary underline-offset-4 hover:underline"
        href={`mailto:${row.original.email}`}
      >
        {row.original.email ?? "N/A"}
      </Link>
    ),
  },
  {
    accessorKey: "createdAt",
    cell: (row) =>
      row.getValue()
        ? new Date(row.getValue() as string).toLocaleDateString()
        : "N/A",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created at" />
    ),
  },
  {
    id: "actions",
    cell: function Cell({ row }) {
      const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
        React.useState(false);
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);
      const params = useParams<{ organizationId: string; branchId: string }>();
      const teacherHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/teacher/${row.original.id}`;

      const handleSuccess = () => {
        row.toggleSelected(false);
        onRefresh?.();
      };

      return (
        <>
          {canManageTeachers ? (
            <UpdateTeacherDialog
              open={showUpdateTaskSheet}
              onOpenChange={setShowUpdateTaskSheet}
              teacher={row.original}
              onSuccess={handleSuccess}
            />
          ) : null}
          <DetailsTeacherDialog
            open={showDetailsTaskDialog}
            onOpenChange={setShowDetailsTaskDialog}
            teacher={row.original}
          />
          {canManageTeachers ? (
            <>
              <DeleteTeacherDialog
                open={showDeleteTaskDialog}
                onOpenChange={setShowDeleteTaskDialog}
                teachers={[row.original]}
                showTrigger={false}
                onSuccess={handleSuccess}
              />
              <ResetUsersDialog
                open={showResetTaskDialog}
                onOpenChange={setShowResetTaskDialog}
                email={row.original.email || ""}
                showTrigger={false}
                onSuccess={() => row.toggleSelected(false)}
              />
            </>
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
              <DropdownMenuItem asChild>
                <Link href={teacherHref}>Voir</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowDetailsTaskDialog(true)}>
                Details
              </DropdownMenuItem>
              {canManageTeachers ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => setShowUpdateTaskSheet(true)}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    Reinitialiser
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
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

export const columns = createTeacherColumns();
