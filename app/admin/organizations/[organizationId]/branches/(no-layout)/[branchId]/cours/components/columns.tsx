"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { IconDots, IconTrash } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/custom/button";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { type ICours } from "@/src/interfaces/Cours";
import { PRIMARY_DOMAIN_SHORT_LABELS, type SystemPrimaryDomainCode } from "@/lib/primary-domains";
import { setCoursStatusAction } from "../cours.action";
import { DeleteCoursDialog } from "./delete-Cours-dialog";
import { UpdateCoursDialog } from "./edit-Cours-dialog";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

export function useCoursColumns(isPrimary = false): ColumnDef<ICours>[] {
  const t = useTranslations("teaching.courses.table");
  const tf = useTranslations("teaching.courses.form");
  const tc = useTranslations("common");
  const locale = useLocale();

  return React.useMemo(() => {
  const cols: ColumnDef<ICours>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t("selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t("selectRow")}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "codeCours",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tc("code")} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.codeCours}</span>
      ),
    },
    {
      accessorKey: "nameCours",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("courseName")} />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.nameCours}</span>
      ),
    },
  ];

  if (isPrimary) {
    cols.push({
      id: "primaryDomain",
      accessorFn: (row) => row.primaryDomain ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("domain")} />
      ),
      cell: ({ row }) => {
        const domain = row.original.primaryDomain;
        if (!domain) {
          return (
            <Badge variant="secondary">{tf("unclassified")}</Badge>
          );
        }
        return (
          <Badge variant="outline">
            {PRIMARY_DOMAIN_SHORT_LABELS[domain as SystemPrimaryDomainCode] ??
              domain}
          </Badge>
        );
      },
    });
  }

  cols.push(
    {
      id: "statusCours",
      accessorFn: (row) =>
        row.statusCours === false ? "inactive" : "active",
      header: tc("status"),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.statusCours === false ? "secondary" : "success"
          }
        >
          {row.original.statusCours === false ? tc("inactive") : tc("active")}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("addedOn")} />
      ),
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString(locale)
          : "—",
    },
    {
      id: "actions",
      cell: function ActionsCell({ row }) {
        const { data: session } = useSession();
        const { refresh } = useRefresh();
        const canManage = canManageOrganization(session);
        const [editOpen, setEditOpen] = React.useState(false);
        const [archiveOpen, setArchiveOpen] = React.useState(false);
        const [deleteOpen, setDeleteOpen] = React.useState(false);
        const [pending, startTransition] = useTransition();

        return (
          <>
            <UpdateCoursDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              cours={row.original}
              isPrimary={isPrimary}
              onSuccess={() => row.toggleSelected(false)}
            />
            <DeleteCoursDialog
              open={archiveOpen}
              onOpenChange={setArchiveOpen}
              Cours={[row.original]}
              showTrigger={false}
              onSuccess={() => row.toggleSelected(false)}
            />
            <DeleteCoursDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              Cours={[row.original]}
              showTrigger={false}
              permanent
              onSuccess={() => row.toggleSelected(false)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("actionsMenu")}
                  variant="ghost"
                  className="flex size-8 p-0"
                >
                  <IconDots className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {canManage && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      openOverlayAfterMenuDismiss(() => setEditOpen(true));
                    }}
                  >
                    {tc("edit")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {canManage &&
                  (row.original.statusCours === false ? (
                    <DropdownMenuItem
                      disabled={pending}
                      onSelect={() =>
                        startTransition(async () => {
                          const [, error] = await setCoursStatusAction({
                            id: row.original.id,
                            active: true,
                          });
                          if (error) {
                            toast.error(error.message);
                            return;
                          }
                          toast.success(t("reactivated"));
                          refresh();
                        })
                      }
                    >
                      {pending ? t("reactivating") : t("reactivate")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        openOverlayAfterMenuDismiss(() => setArchiveOpen(true));
                      }}
                    >
                      {tc("deactivate")}
                    </DropdownMenuItem>
                  ))}
                {canManage ? (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={(event) => {
                      event.preventDefault();
                      openOverlayAfterMenuDismiss(() => setDeleteOpen(true));
                    }}
                  >
                    <IconTrash className="mr-2 size-4" />
                    {tc("delete")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        );
      },
    },
  );

  return cols;
  }, [isPrimary, locale, t, tf, tc]);
}
