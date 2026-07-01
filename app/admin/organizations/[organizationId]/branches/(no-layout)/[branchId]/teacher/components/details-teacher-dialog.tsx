"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ITeacher } from "@/src/interfaces/Teacher";
import { CarteEnseignantComplete } from "./teacher-card";
import { ITeaching } from "@/src/interfaces/Teaching";
import { ICalendarEvent } from "@/src/interfaces/CalendarEvent";

interface DetailsTeacherDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  teacher: ITeacher;
  teaching?: ITeaching[];
  calendarEvent?: ICalendarEvent[];
}

export function DetailsTeacherDialog({
  showTrigger = true,
  onSuccess,
  teacher,
  calendarEvent,
  ...props
}: DetailsTeacherDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent className="py-9">
        <CarteEnseignantComplete
          teacher={teacher}
          // calendarEvent={calendarEvent}
        />
      </DialogContent>
    </Dialog>
  );
}
