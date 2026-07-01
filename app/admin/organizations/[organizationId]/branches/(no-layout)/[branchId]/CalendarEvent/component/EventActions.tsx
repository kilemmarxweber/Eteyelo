"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/custom/button";
import { IconDots } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EventActions({ id }: { id: string }) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/admin/events/${id}`)}>
          Voir
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => alert("edit modal")}>
          Modifier
        </DropdownMenuItem>

        <DropdownMenuItem className="text-red-500">Supprimer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
