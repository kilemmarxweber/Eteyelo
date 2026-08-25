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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ITeacher } from "@/src/interfaces/Teacher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { normalizeImageSrc } from "@/lib/utils";

import { ResetUsersDialog } from "../../student/components/reset-users-dialog";
import { DeleteTeacherDialog } from "./delete-teacher-dialog";
import { DetailsTeacherDialog } from "./details-teacher-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export type TeacherTableActions = {
  onEdit: (teacher: ITeacher) => void;
};

export const createTeacherColumns = (
  onRefresh?: () => void,
  canManageTeachers = true,
  actions?: TeacherTableActions,
  canPurgePermanently = false,
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
    cell: ({ row }) => {
      const fullName =
        [row.original.nom, row.original.postnom, row.original.prenom]
          .filter(Boolean)
          .join(" ") || "N/A";
      const initials =
        `${row.original.nom?.[0] ?? ""}${row.original.prenom?.[0] ?? ""}`.toUpperCase() ||
        "EN";
      return (
        <div className="flex min-w-44 items-center gap-2.5">
          <Avatar className="size-9 shrink-0">
            {row.original.image ? (
              <AvatarImage
                src={normalizeImageSrc(row.original.image)}
                alt={fullName}
              />
            ) : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.username || row.original.email || "Enseignant"}
            </p>
          </div>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const search = String(value).toLowerCase().trim();
      const nom = String(row.getValue(id) ?? "").toLowerCase();
      const postnom = String(row.original.postnom ?? "").toLowerCase();
      const prenom = String(row.original.prenom ?? "").toLowerCase();

      return (
        nom.includes(search) ||
        postnom.includes(search) ||
        prenom.includes(search)
      );
    },
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
        <AssignmentListPopover
          label={`${names.length} classe${names.length > 1 ? "s" : ""}`}
          title="Classes assignées"
          names={names}
        />
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
        <AssignmentListPopover
          label={`${names.length} cours`}
          title="Cours assignés"
          names={names}
        />
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
    id: "actions",
    cell: function Cell({ row }) {
      const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
        React.useState(false);
      const [showPurgeTaskDialog, setShowPurgeTaskDialog] =
        React.useState(false);
      const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
        React.useState(false);
      const [showResetTaskDialog, setShowResetTaskDialog] =
        React.useState(false);
      const params = useParams<{ organizationId: string; branchId: string }>();
      const teacherHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/teacher/${row.original.id}`;
      const isArchived = row.original.statusUser === false;

      const handleSuccess = () => {
        row.toggleSelected(false);
        onRefresh?.();
      };

      return (
        <>
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
              {canPurgePermanently ? (
                <DeleteTeacherDialog
                  open={showPurgeTaskDialog}
                  onOpenChange={setShowPurgeTaskDialog}
                  teachers={[row.original]}
                  showTrigger={false}
                  permanent
                  onSuccess={handleSuccess}
                />
              ) : null}
              <ResetUsersDialog
                open={showResetTaskDialog}
                onOpenChange={setShowResetTaskDialog}
                email={row.original.email || ""}
                organizationId={params.organizationId}
                showTrigger={false}
                onSuccess={() => row.toggleSelected(false)}
              />
            </>
          ) : null}

          <DropdownMenu modal={false}>
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
                    onSelect={(event) => {
                      event.preventDefault();
                      if (!actions) return;
                      openOverlayAfterMenuDismiss(() =>
                        actions.onEdit(row.original),
                      );
                    }}
                  >
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    Reinitialiser
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!isArchived ? (
                    <DropdownMenuItem
                      onSelect={() => setShowDeleteTaskDialog(true)}
                    >
                      Archiver
                      <DropdownMenuShortcut>Del</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}
                  {canPurgePermanently ? (
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => setShowPurgeTaskDialog(true)}
                    >
                      Supprimer
                      <DropdownMenuShortcut>⇧Del</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];

function AssignmentListPopover({
  label,
  title,
  names,
}: {
  label: string;
  title: string;
  names: string[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 min-w-24 justify-center rounded-full"
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{names.length} élément(s)</p>
        </div>
        <div className="max-h-56 overflow-y-auto p-2">
          {names.map((name, index) => (
            <div
              key={`${name}-${index}`}
              className="mb-1 rounded-md bg-muted/50 px-3 py-2 text-sm last:mb-0"
            >
              {name}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const columns = createTeacherColumns();
