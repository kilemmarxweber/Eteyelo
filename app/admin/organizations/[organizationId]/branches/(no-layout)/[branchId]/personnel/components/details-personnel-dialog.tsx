"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { UserCard } from "./personnel-card";

interface DetailsPersonnelDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  personnel: IPersonnel;
}

export function DetailsPersonnelDialog({
  showTrigger = true,
  onSuccess,
  personnel,
  ...props
}: DetailsPersonnelDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent className="py-9">
        <Card className="w-full max-w-4xl">
          <UserCard personnel={personnel} child={[]} />
        </Card>
      </DialogContent>
    </Dialog>
  );
}
