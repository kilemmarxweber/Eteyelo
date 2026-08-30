"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card } from "@/components/ui/card";
import { IParent } from "@/src/interfaces/Parent";
import { UserCard } from "./parent-card";

interface DetailsParentDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  parent: IParent;
}

export function DetailsParentDialog({
  showTrigger = true,
  onSuccess,
  parent,
  ...props
}: DetailsParentDialogProps) {
  const [open, setOpen] = React.useState(false);
  const tPdf = useTranslations("users.parents.pdf");

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent size="lg" className="py-6">
        <DialogHeader>
          <DialogTitle>{tPdf("detailsTitle")}</DialogTitle>
        </DialogHeader>

        <Card className="w-full max-w-4xl">
          <UserCard parent={parent} childs={[]} payments={[]} />
        </Card>
      </DialogContent>
    </Dialog>
  );
}
