"use client";

import React, { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { IconDots } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteParentDialog } from "./delete-parent-dialog";
import { DetailsParentDialog } from "./details-parent-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { IParent } from "@/src/interfaces/Parent";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { ResetUsersDialog } from "../../student/components/reset-users-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export type ParentTableActions = {
  onEdit: (parent: IParent) => void;
};

export function useParentColumns(
  actions?: ParentTableActions,
  canPurgePermanently = false,
): ColumnDef<IParent>[] {
  const t = useTranslations("users.parents.table");
  const tPerson = useTranslations("common.person");
  const tCommon = useTranslations("common");
  const locale = useLocale();

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
        accessorKey: "nom",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tPerson("lastName")}
          />
        ),
        cell: ({ row }) => row.original.nom ?? "N/A",
        filterFn: (row, id, value) => {
          const search = String(value).toLowerCase().trim();
          const nom = String(row.getValue("nom") ?? "").toLowerCase();
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
          <DataTableColumnHeader column={column} title={t("identifier")} />
        ),
        cell: ({ row }) => row.original.postnom ?? "N/A",
      },
      {
        accessorKey: "prenom",
        header: tPerson("firstName"),
        cell: ({ row }) => row.original.prenom ?? "N/A",
      },
      {
        accessorKey: "sexe",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tPerson("gender")} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span>{row.original.sexe}</span>
          </div>
        ),
        filterFn: (row, id, value) => {
          const raw = String(row.getValue(id) ?? "").toLowerCase();
          const selected = (Array.isArray(value) ? value : [value]).map((v) =>
            String(v).toLowerCase(),
          );
          return selected.some((v) => {
            if (v === "masculin" || v === "m")
              return raw === "m" || raw === "masculin";
            if (v === "feminin" || v === "f")
              return raw === "f" || raw === "feminin";
            return raw === v;
          });
        },
      },
      {
        id: "statusUser",
        accessorFn: (row) => (row.statusUser === false ? "archived" : "active"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tCommon("status")} />
        ),
        cell: ({ row }) =>
          row.original.statusUser === false
            ? t("archived")
            : tCommon("active"),
        filterFn: (row, id, value) => {
          const selected = Array.isArray(value) ? value : [value];
          return selected.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "dateOfBirth",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("creationDate")} />
        ),
        cell: (row) =>
          new Date(row.getValue() as string).toLocaleDateString(locale),
      },
      {
        accessorKey: "telephone",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tPerson("phone")} />
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
          <DataTableColumnHeader column={column} title={tPerson("email")} />
        ),
        cell: ({ row }) => (
          <div>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href={`mailto:${row.original.email}`}
            >
              {row.original.email ?? "N/A"}
            </Link>
          </div>
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

          return (
            <>
              <DetailsParentDialog
                open={showDetailsTaskDialog}
                onOpenChange={setShowDetailsTaskDialog}
                parent={row.original}
              />

              <DeleteParentDialog
                open={showDeleteTaskDialog}
                onOpenChange={setShowDeleteTaskDialog}
                parents={[row.original]}
                showTrigger={false}
                onSuccess={() => row.toggleSelected(false)}
              />
              {canPurgePermanently ? (
                <DeleteParentDialog
                  open={showPurgeTaskDialog}
                  onOpenChange={setShowPurgeTaskDialog}
                  parents={[row.original]}
                  showTrigger={false}
                  permanent
                  onSuccess={() => row.toggleSelected(false)}
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

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={tCommon("openMenu")}
                    variant="ghost"
                    className="flex size-8 p-0 data-[state= open]:bg-muted"
                  >
                    <IconDots className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onSelect={() => setShowDetailsTaskDialog(true)}
                  >
                    {t("details")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      if (!actions) return;
                      openOverlayAfterMenuDismiss(() =>
                        actions.onEdit(row.original),
                      );
                    }}
                  >
                    {t("edit")}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => setShowResetTaskDialog(true)}
                  >
                    {tCommon("reset")}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {row.original.statusUser !== false ? (
                    <DropdownMenuItem
                      onSelect={() => setShowDeleteTaskDialog(true)}
                    >
                      {tCommon("archive")}
                      <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}
                  {canPurgePermanently ? (
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      title={t("purgeHint")}
                      onSelect={() => setShowPurgeTaskDialog(true)}
                    >
                      {tCommon("delete")}
                      <DropdownMenuShortcut>⇧Del</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        },
      },
    ],
    [actions, canPurgePermanently, locale, t, tCommon, tPerson],
  );
}

/** @deprecated Use useParentColumns() hook instead */
export const columns: ColumnDef<IParent>[] = [];
