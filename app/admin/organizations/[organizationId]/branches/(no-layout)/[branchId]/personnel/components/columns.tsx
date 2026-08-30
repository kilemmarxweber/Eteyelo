"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/custom/button";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { normalizeImageSrc } from "@/lib/utils";
import { IPersonnel } from "@/src/interfaces/Personnel";

import { ResetUsersDialog } from "../../student/components/reset-users-dialog";
import { AddPersonnelRole } from "./add-personnelrole-dialog";
import { DeletePersonalDialog } from "./delete-personal-dialog";
import { DetailsPersonnelDialog } from "./details-personnel-dialog";
import { MakePersonnelTeacherDialog } from "./make-personnel-teacher-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export type PersonnelTableActions = {
  onEdit: (personnel: IPersonnel) => void;
};

export function usePersonnelColumns(
  onRefresh?: () => void,
  canManagePersonnel = true,
  actions?: PersonnelTableActions,
  canPurgePermanently = false,
): ColumnDef<IPersonnel>[] {
  const t = useTranslations("users.staff.table");
  const tStaff = useTranslations("users.staff");
  const tPerson = useTranslations("common.person");
  const tCommon = useTranslations("common");

  return useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label={tCommon("selectAll")}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={tCommon("selectRow")}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "photo",
        header: t("photo"),
        cell: ({ row }) => {
          const personnel = row.original;
          const fullName =
            [personnel.nom, personnel.postnom, personnel.prenom]
              .filter(Boolean)
              .join(" ") || tStaff("badge");
          const initials =
            `${personnel.nom?.[0] ?? ""}${personnel.prenom?.[0] ?? ""}`.toUpperCase() ||
            "PE";

          return (
            <div className="flex items-center justify-center">
              <Avatar className="size-11 border border-border ring-2 ring-white">
                {personnel.image ? (
                  <AvatarImage
                    src={normalizeImageSrc(personnel.image)}
                    alt={fullName}
                  />
                ) : null}
                <AvatarFallback className="bg-blue-50 text-sm font-black text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "nom",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tPerson("lastName")}
          />
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
          <DataTableColumnHeader column={column} title={tPerson("postnom")} />
        ),
        cell: ({ row }) => (
          <span className="text-foreground/80">
            {row.original.postnom ?? "N/A"}
          </span>
        ),
      },
      {
        accessorKey: "prenom",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tPerson("firstName")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-foreground/80">
            {row.original.prenom ?? "N/A"}
          </span>
        ),
      },
      {
        accessorKey: "sexe",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tPerson("gender")} />
        ),
        cell: ({ row }) => {
          const sexe = row.original.sexe;
          if (sexe === "M") return tPerson("male");
          if (sexe === "F") return tPerson("female");
          return sexe ?? "N/A";
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        id: "role",
        accessorFn: (row) => row.role ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("role")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-primary">
            {row.original.role
              ? orgRoleLabel(row.original.role)
              : t("roleUndefined")}
          </span>
        ),
      },
      {
        accessorKey: "telephone",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tPerson("phone")} />
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
          <DataTableColumnHeader column={column} title={tPerson("email")} />
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
          const [showPurgeTaskDialog, setShowPurgeTaskDialog] =
            React.useState(false);
          const [showDetailsTaskDialog, setShowDetailsTaskDialog] =
            React.useState(false);
          const [showResetTaskDialog, setShowResetTaskDialog] =
            React.useState(false);
          const [showMakeTeacherDialog, setShowMakeTeacherDialog] =
            React.useState(false);

          const params = useParams<{ organizationId: string; branchId: string }>();
          const personnel = row.original;
          const isArchived = personnel.statusUser === false;

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
                  <MakePersonnelTeacherDialog
                    open={showMakeTeacherDialog}
                    onOpenChange={setShowMakeTeacherDialog}
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
                  {canPurgePermanently ? (
                    <DeletePersonalDialog
                      open={showPurgeTaskDialog}
                      onOpenChange={setShowPurgeTaskDialog}
                      personals={[personnel]}
                      showTrigger={false}
                      permanent
                      onSuccess={handleSuccess}
                    />
                  ) : null}
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
                    aria-label={tCommon("openMenu")}
                    variant="ghost"
                    className="flex size-8 p-0 text-foreground hover:bg-blue-50 data-[state=open]:bg-blue-50"
                  >
                    <IconDots className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={() => setShowDetailsTaskDialog(true)}
                  >
                    {t("details")}
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
                        {t("edit")}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onSelect={() => setShowPersonnalRoleSheet(true)}
                      >
                        {t("assignRole")}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onSelect={() => setShowResetTaskDialog(true)}
                      >
                        {tCommon("reset")}
                      </DropdownMenuItem>

                      {!isArchived && !personnel.alsoTeacher ? (
                        <DropdownMenuItem
                          onSelect={() => setShowMakeTeacherDialog(true)}
                        >
                          {t("makeTeacher")}
                        </DropdownMenuItem>
                      ) : null}

                      <DropdownMenuSeparator />

                      {!isArchived ? (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onSelect={() => setShowDeleteTaskDialog(true)}
                        >
                          {tCommon("archive")}
                          <DropdownMenuShortcut>Del</DropdownMenuShortcut>
                        </DropdownMenuItem>
                      ) : null}

                      {canPurgePermanently ? (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onSelect={() => setShowPurgeTaskDialog(true)}
                        >
                          {tCommon("delete")}
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
    ],
    [actions, canManagePersonnel, canPurgePermanently, onRefresh, t, tCommon, tPerson, tStaff],
  );
}
