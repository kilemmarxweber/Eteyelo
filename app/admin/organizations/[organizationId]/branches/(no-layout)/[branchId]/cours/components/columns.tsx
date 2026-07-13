"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/custom/button";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { type ICours } from "@/src/interfaces/Cours";
import { setCoursStatusAction } from "../cours.action";
import { DeleteCoursDialog } from "./delete-Cours-dialog";
import { UpdateCoursDialog } from "./edit-Cours-dialog";

export const columns: ColumnDef<ICours>[] = [
  {
    id: "select",
    header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")} onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)} aria-label="Tout sélectionner" />,
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={value => row.toggleSelected(!!value)} aria-label="Sélectionner le cours" />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "codeCours",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.codeCours}</span>,
  },
  {
    accessorKey: "nameCours",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nom du cours" />,
    cell: ({ row }) => <span className="font-medium">{row.original.nameCours}</span>,
  },
  {
    id: "statusCours",
    accessorFn: row => row.statusCours === false ? "inactive" : "active",
    header: "Statut",
    cell: ({ row }) => <Badge variant={row.original.statusCours === false ? "secondary" : "success"}>{row.original.statusCours === false ? "Inactif" : "Actif"}</Badge>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date d'ajout" />,
    cell: ({ row }) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("fr-FR") : "—",
  },
  {
    id: "actions",
    cell: function ActionsCell({ row }) {
      const { data: session } = useSession();
      const { refresh } = useRefresh();
      const canManage = canManageOrganization(session);
      const [editOpen, setEditOpen] = React.useState(false);
      const [archiveOpen, setArchiveOpen] = React.useState(false);
      const [pending, startTransition] = React.useTransition();

      return <>
        <UpdateCoursDialog open={editOpen} onOpenChange={setEditOpen} cours={row.original} onSuccess={() => row.toggleSelected(false)} />
        <DeleteCoursDialog open={archiveOpen} onOpenChange={setArchiveOpen} Cours={[row.original]} showTrigger={false} onSuccess={() => row.toggleSelected(false)} />
        <DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="Actions du cours" variant="ghost" className="flex size-8 p-0"><IconDots className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {canManage && <DropdownMenuItem onSelect={() => setEditOpen(true)}>Modifier</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {canManage && (row.original.statusCours === false
              ? <DropdownMenuItem disabled={pending} onSelect={() => startTransition(async () => {
                  const [, error] = await setCoursStatusAction({ id: row.original.id, active: true });
                  if (error) { toast.error(error.message); return; }
                  toast.success("Cours réactivé avec succès");
                  refresh();
                })}>{pending ? "Réactivation..." : "Réactiver"}</DropdownMenuItem>
              : <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>Désactiver</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </>;
    },
  },
];
